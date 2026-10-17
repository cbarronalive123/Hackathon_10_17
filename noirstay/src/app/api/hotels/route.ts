import { NextResponse } from "next/server";
import { query, one } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = (url.searchParams.get("q") ?? "").trim();
  const city = url.searchParams.get("city") ?? "";
  const country = url.searchParams.get("country") ?? "";
  const maxPrice = Number(url.searchParams.get("maxPrice")) || null;
  const minStars = Number(url.searchParams.get("minStars")) || null;
  const minRating = Number(url.searchParams.get("minRating")) || null;
  const featured = url.searchParams.get("featured") === "1";
  const sort = url.searchParams.get("sort") ?? "recommended";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 100);
  const idsParam = url.searchParams.get("ids");

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 20);
    if (ids.length) {
      params.push(ids);
      where.push(`id = ANY($${params.length})`);
    }
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(name ILIKE $${params.length} OR city ILIKE $${params.length} OR country ILIKE $${params.length})`);
  }
  if (city) {
    params.push(city);
    where.push(`city = $${params.length}`);
  }
  if (country) {
    params.push(country);
    where.push(`country = $${params.length}`);
  }
  if (maxPrice) {
    params.push(maxPrice);
    where.push(`price_per_night <= $${params.length}`);
  }
  if (minStars) {
    params.push(minStars);
    where.push(`star_rating >= $${params.length}`);
  }
  if (minRating) {
    params.push(minRating);
    where.push(`guest_rating >= $${params.length}`);
  }
  if (featured) {
    where.push(`featured = TRUE`);
  }

  const orderBy =
    sort === "price-asc"
      ? "price_per_night ASC"
      : sort === "price-desc"
        ? "price_per_night DESC"
        : sort === "rating"
          ? "guest_rating DESC, reviews_count DESC"
          : sort === "stars"
            ? "star_rating DESC, guest_rating DESC"
            : "featured DESC, guest_rating DESC";

  const hotels = await query(
    `SELECT * FROM hotels WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT ${limit}`,
    params
  );
  return NextResponse.json({ hotels });
}

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const b = await req.json();
    const name = String(b.name ?? "").trim();
    const city = String(b.city ?? "").trim();
    const country = String(b.country ?? "").trim();
    const price = Number(b.price_per_night);

    if (!name || !city || !country || !price || price <= 0) {
      return NextResponse.json(
        { error: "Name, city, country and a price above 0 are required." },
        { status: 400 }
      );
    }

    const hotel = await one(
      `INSERT INTO hotels (name, city, country, address, description, star_rating, guest_rating,
        reviews_count, price_per_night, image_url, amenities, provider, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        name,
        city,
        country,
        String(b.address ?? ""),
        String(b.description ?? ""),
        Math.min(Math.max(Number(b.star_rating) || 3, 1), 5),
        Math.min(Math.max(Number(b.guest_rating) || 8, 0), 10),
        Number(b.reviews_count) || 0,
        price,
        String(b.image_url ?? ""),
        Array.isArray(b.amenities) ? b.amenities.map(String).filter(Boolean) : [],
        String(b.provider ?? "NoirStay Direct"),
        Boolean(b.featured),
      ]
    );
    return NextResponse.json({ hotel }, { status: 201 });
  } catch (err) {
    console.error("create hotel error", err);
    return NextResponse.json({ error: "Could not create the hotel." }, { status: 500 });
  }
}
