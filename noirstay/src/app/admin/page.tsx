import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Overview" };

export default async function AdminPage() {
  const [stats] = await query<{
    total_users: number;
    total_hotels: number;
    total_bookings: number;
    revenue: string | null;
    upcoming: number;
    cities: number;
  }>(
    `SELECT
      (SELECT count(*)::int FROM users WHERE role = 'customer')                                    AS total_users,
      (SELECT count(*)::int FROM hotels)                                                           AS total_hotels,
      (SELECT count(*)::int FROM bookings)                                                         AS total_bookings,
      (SELECT COALESCE(sum(total_price), 0)::text FROM bookings WHERE status <> 'cancelled')       AS revenue,
      (SELECT count(*)::int FROM bookings WHERE check_in >= CURRENT_DATE AND status <> 'cancelled') AS upcoming,
      (SELECT count(DISTINCT city)::int FROM hotels)                                               AS cities`
  );

  const recent = await query<{
    id: number;
    hotel_name: string;
    hotel_city: string;
    user_name: string;
    check_in: string;
    total_price: string;
    status: string;
  }>(
    `SELECT b.id, b.check_in, b.total_price, b.status,
            h.name AS hotel_name, h.city AS hotel_city, u.name AS user_name
     FROM bookings b
     JOIN hotels h ON h.id = b.hotel_id
     JOIN users u ON u.id = b.user_id
     ORDER BY b.created_at DESC LIMIT 8`
  );

  const topHotels = await query<{
    id: number;
    name: string;
    city: string;
    booking_count: number;
    revenue: string;
  }>(
    `SELECT h.id, h.name, h.city,
            count(b.id)::int AS booking_count,
            COALESCE(sum(b.total_price) FILTER (WHERE b.status <> 'cancelled'), 0)::text AS revenue
     FROM hotels h
     LEFT JOIN bookings b ON b.hotel_id = h.id
     GROUP BY h.id
     ORDER BY booking_count DESC, h.guest_rating DESC
     LIMIT 6`
  );

  const statCards = [
    { label: "Customers", value: stats.total_users, href: "/admin/users" },
    { label: "Hotels listed", value: stats.total_hotels, href: "/admin/hotels" },
    { label: "Total bookings", value: stats.total_bookings, href: "/admin/bookings" },
    { label: "Revenue (excl. cancelled)", value: `$${Number(stats.revenue).toLocaleString()}`, href: "/admin/bookings" },
    { label: "Upcoming check-ins", value: stats.upcoming, href: "/admin/bookings" },
    { label: "Cities covered", value: stats.cities, href: "/admin/hotels" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-zinc-800 bg-black/60 p-5 transition-colors hover:border-zinc-600"
          >
            <p className="text-xs uppercase tracking-widest text-zinc-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-black/60 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">Latest bookings</h3>
            <Link href="/admin/bookings" className="text-xs text-zinc-500 hover:text-zinc-200">
              Manage →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-zinc-800/80">
            {recent.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{b.hotel_name}</p>
                  <p className="text-xs text-zinc-500">
                    {b.user_name} · {new Date(b.check_in).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-white">${Number(b.total_price).toLocaleString()}</span>
                  <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-zinc-400">
                    {b.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-black/60 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">Top hotels by bookings</h3>
            <Link href="/admin/hotels" className="text-xs text-zinc-500 hover:text-zinc-200">
              Manage →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-zinc-800/80">
            {topHotels.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{h.name}</p>
                  <p className="text-xs text-zinc-500">{h.city}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-white">
                    {h.booking_count} booking{h.booking_count === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-zinc-500">${Number(h.revenue).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
