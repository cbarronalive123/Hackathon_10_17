import Link from "next/link";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;

  const [stats] = await query<{
    total: number;
    upcoming: number;
    nights: number;
    spend: string | null;
  }>(
    `SELECT
      count(*)::int                                                    AS total,
      count(*) FILTER (WHERE check_in >= CURRENT_DATE AND status <> 'cancelled')::int AS upcoming,
      COALESCE(sum(nights) FILTER (WHERE status = 'completed'), 0)::int AS nights,
      COALESCE(sum(total_price) FILTER (WHERE status <> 'cancelled'), 0)::text AS spend
    FROM bookings WHERE user_id = $1`,
    [user.id]
  );

  const upcoming = await query<Booking>(
    `SELECT b.*, h.name AS hotel_name, h.city AS hotel_city, h.country AS hotel_country
     FROM bookings b JOIN hotels h ON h.id = b.hotel_id
     WHERE b.user_id = $1 AND b.check_in >= CURRENT_DATE AND b.status <> 'cancelled'
     ORDER BY b.check_in ASC LIMIT 4`,
    [user.id]
  );

  const recent = await query<Booking>(
    `SELECT b.*, h.name AS hotel_name, h.city AS hotel_city
     FROM bookings b JOIN hotels h ON h.id = b.hotel_id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC LIMIT 5`,
    [user.id]
  );

  const statCards = [
    { label: "Upcoming stays", value: stats.upcoming },
    { label: "Total bookings", value: stats.total },
    { label: "Nights stayed", value: stats.nights },
    { label: "Lifetime spend", value: `$${Number(stats.spend ?? 0).toLocaleString()}` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          Welcome back, {user.name.split(" ")[0]}.
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Member since{" "}
          {new Date(user.created_at).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-black/60 p-5">
            <p className="text-xs uppercase tracking-widest text-zinc-500">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-black/60 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">Upcoming stays</h3>
            <Link href="/dashboard/bookings" className="text-xs text-zinc-500 hover:text-zinc-200">
              View all →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-zinc-500">Nothing on the calendar yet.</p>
              <Link
                href="/hotels"
                className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200"
              >
                Find a stay
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800/80">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{b.hotel_name}</p>
                    <p className="text-xs text-zinc-500">
                      {b.hotel_city} · {new Date(b.check_in).toLocaleDateString()} →{" "}
                      {new Date(b.check_out).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-white">${Number(b.total_price).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-black/60 p-5">
          <h3 className="font-medium text-white">Recent activity</h3>
          {recent.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">No bookings yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800/80">
              {recent.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{b.hotel_name}</p>
                    <p className="text-xs text-zinc-500">
                      Booked {new Date(b.created_at).toLocaleDateString()} · {b.nights} night
                      {b.nights > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider"
                    style={{
                      borderColor:
                        b.status === "cancelled" ? "#3f3f46" : "#52525b",
                      color: b.status === "cancelled" ? "#71717a" : "#d4d4d8",
                    }}
                  >
                    {b.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
