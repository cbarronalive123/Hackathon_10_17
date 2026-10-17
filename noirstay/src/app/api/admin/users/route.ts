import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const users = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
            count(b.id)::int AS booking_count,
            COALESCE(sum(b.total_price) FILTER (WHERE b.status <> 'cancelled'), 0)::text AS total_spend
     FROM users u
     LEFT JOIN bookings b ON b.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at ASC`
  );
  return NextResponse.json({ users });
}
