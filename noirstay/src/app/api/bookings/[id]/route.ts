import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["pending", "confirmed", "cancelled", "completed"];

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await ctx.params;
  const bookingId = Number(id);
  const b = await req.json();
  const status = String(b.status ?? "");

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const existing = await one<{ user_id: number }>("SELECT user_id FROM bookings WHERE id = $1", [
    bookingId,
  ]);
  if (!existing) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  if (session.role !== "admin") {
    if (existing.user_id !== session.id) {
      return NextResponse.json({ error: "Not your booking." }, { status: 403 });
    }
    if (status !== "cancelled") {
      return NextResponse.json(
        { error: "You can only cancel your bookings." },
        { status: 403 }
      );
    }
  }

  const booking = await one("UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *", [
    status,
    bookingId,
  ]);
  return NextResponse.json({ booking });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getCurrentUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const booking = await one("DELETE FROM bookings WHERE id = $1 RETURNING id", [Number(id)]);
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
