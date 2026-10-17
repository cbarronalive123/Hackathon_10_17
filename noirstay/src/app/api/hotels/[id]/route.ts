import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const hotel = await one("SELECT * FROM hotels WHERE id = $1", [Number(id)]);
  if (!hotel) return NextResponse.json({ error: "Hotel not found." }, { status: 404 });
  return NextResponse.json({ hotel });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getCurrentUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const hotelId = Number(id);
  const b = await req.json();

  const fields: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => {
    params.push(value);
    fields.push(`${column} = $${params.length}`);
  };

  if (b.name !== undefined) add("name", String(b.name).trim());
  if (b.city !== undefined) add("city", String(b.city).trim());
  if (b.country !== undefined) add("country", String(b.country).trim());
  if (b.address !== undefined) add("address", String(b.address));
  if (b.description !== undefined) add("description", String(b.description));
  if (b.star_rating !== undefined) add("star_rating", Math.min(Math.max(Number(b.star_rating) || 3, 1), 5));
  if (b.guest_rating !== undefined) add("guest_rating", Math.min(Math.max(Number(b.guest_rating) || 8, 0), 10));
  if (b.reviews_count !== undefined) add("reviews_count", Number(b.reviews_count) || 0);
  if (b.price_per_night !== undefined) {
    const price = Number(b.price_per_night);
    if (!price || price <= 0) {
      return NextResponse.json({ error: "Price must be above 0." }, { status: 400 });
    }
    add("price_per_night", price);
  }
  if (b.image_url !== undefined) add("image_url", String(b.image_url));
  if (b.amenities !== undefined) {
    add("amenities", Array.isArray(b.amenities) ? b.amenities.map(String).filter(Boolean) : []);
  }
  if (b.provider !== undefined) add("provider", String(b.provider));
  if (b.featured !== undefined) add("featured", Boolean(b.featured));

  if (!fields.length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  params.push(hotelId);
  const hotel = await one(
    `UPDATE hotels SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!hotel) return NextResponse.json({ error: "Hotel not found." }, { status: 404 });
  return NextResponse.json({ hotel });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getCurrentUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const used = await one<{ count: number }>("SELECT count(*)::int AS count FROM bookings WHERE hotel_id = $1", [
    Number(id),
  ]);
  if (used && used.count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${used.count} booking(s) reference this hotel.` },
      { status: 409 }
    );
  }
  const hotel = await one("DELETE FROM hotels WHERE id = $1 RETURNING id", [Number(id)]);
  if (!hotel) return NextResponse.json({ error: "Hotel not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
