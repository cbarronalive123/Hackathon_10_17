import { NextResponse } from "next/server";
import { query, one } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "mine";

  if (scope === "all" && session.role === "admin") {
    const bookings = await query(
      `SELECT b.*, h.name AS hotel_name, h.city AS hotel_city, h.country AS hotel_country,
              h.image_url AS hotel_image, u.name AS user_name, u.email AS user_email
       FROM bookings b
       JOIN hotels h ON h.id = b.hotel_id
       JOIN users u ON u.id = b.user_id
       ORDER BY b.created_at DESC
       LIMIT 500`
    );
    return NextResponse.json({ bookings });
  }

  const bookings = await query(
    `SELECT b.*, h.name AS hotel_name, h.city AS hotel_city, h.country AS hotel_country,
            h.image_url AS hotel_image
     FROM bookings b
     JOIN hotels h ON h.id = b.hotel_id
     WHERE b.user_id = $1
     ORDER BY b.check_in DESC`,
    [session.id]
  );
  return NextResponse.json({ bookings });
}

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Please sign in to book." }, { status: 401 });
  }

  try {
    const b = await req.json();
    const hotelId = Number(b.hotel_id);
    const checkIn = String(b.check_in ?? "");
    const checkOut = String(b.check_out ?? "");
    const guests = Math.max(Number(b.guests) || 1, 1);
    const rooms = Math.min(Math.max(Number(b.rooms) || 1, 1), 5);
    const roomType = String(b.room_type ?? "Standard King");

    if (!hotelId || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      return NextResponse.json({ error: "Invalid booking details." }, { status: 400 });
    }

    const hotel = await one<{ price_per_night: string }>(
      "SELECT price_per_night FROM hotels WHERE id = $1",
      [hotelId]
    );
    if (!hotel) {
      return NextResponse.json({ error: "Hotel not found." }, { status: 404 });
    }

    const inD = new Date(checkIn);
    const outD = new Date(checkOut);
    const nights = Math.round((outD.getTime() - inD.getTime()) / 86400000);
    if (nights < 1 || nights > 30) {
      return NextResponse.json({ error: "Stay must be between 1 and 30 nights." }, { status: 400 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (inD < today) {
      return NextResponse.json({ error: "Check-in date cannot be in the past." }, { status: 400 });
    }

    const price = Number(hotel.price_per_night);
    const total = (price * nights * rooms).toFixed(2);

    const booking = await one(
      `INSERT INTO bookings (user_id, hotel_id, room_type, check_in, check_out, guests, rooms, nights, total_price, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed') RETURNING *`,
      [session.id, hotelId, roomType, checkIn, checkOut, guests, rooms, nights, total]
    );
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    console.error("booking error", err);
    return NextResponse.json({ error: "Could not create the booking." }, { status: 500 });
  }
}
