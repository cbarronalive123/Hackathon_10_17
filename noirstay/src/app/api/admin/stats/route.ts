import { NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const [stats] = await query<{
    total_users: number;
    total_hotels: number;
    total_bookings: number;
    revenue: string | null;
    upcoming: number;
    cities: number;
  }>(
    `SELECT
      (SELECT count(*)::int FROM users WHERE role = 'customer')                                   AS total_users,
      (SELECT count(*)::int FROM hotels)                                                          AS total_hotels,
      (SELECT count(*)::int FROM bookings)                                                        AS total_bookings,
      (SELECT COALESCE(sum(total_price), 0)::text FROM bookings WHERE status <> 'cancelled')      AS revenue,
      (SELECT count(*)::int FROM bookings WHERE check_in >= CURRENT_DATE AND status <> 'cancelled') AS upcoming,
      (SELECT count(DISTINCT city)::int FROM hotels)                                              AS cities`
  );

  const recent = await query(
    `SELECT b.id, b.check_in, b.check_out, b.total_price, b.status, b.created_at,
            h.name AS hotel_name, h.city AS hotel_city, u.name AS user_name
     FROM bookings b
     JOIN hotels h ON h.id = b.hotel_id
     JOIN users u ON u.id = b.user_id
     ORDER BY b.created_at DESC LIMIT 8`
  );

  const topHotels = await query(
    `SELECT h.id, h.name, h.city, h.price_per_night,
            count(b.id)::int AS booking_count,
            COALESCE(sum(b.total_price) FILTER (WHERE b.status <> 'cancelled'), 0)::text AS revenue
     FROM hotels h
     LEFT JOIN bookings b ON b.hotel_id = h.id
     GROUP BY h.id
     ORDER BY booking_count DESC, h.guest_rating DESC
     LIMIT 6`
  );

  const bookingStatus = await one<{ pending: number; confirmed: number; completed: number; cancelled: number }>(
    `SELECT
      count(*) FILTER (WHERE status = 'pending')::int   AS pending,
      count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
      count(*) FILTER (WHERE status = 'completed')::int AS completed,
      count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
    FROM bookings`
  );

  return NextResponse.json({
    stats: {
      ...stats,
      revenue: Number(stats?.revenue ?? 0),
    },
    recent,
    topHotels,
    bookingStatus,
  });
}
