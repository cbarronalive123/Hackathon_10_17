import { query } from "@/lib/db";

// Nuitee Connect (liteAPI) live hotel inventory.
// Docs: https://docs.liteapi.travel/ — sandbox key lives in LITEAPI_KEY.

const LITEAPI_BASE = "https://api.liteapi.travel/v3.0";

export type LiveSearch = {
  /** City or area name, e.g. "New York" */
  cityName: string;
  /** ISO 2-letter country code, e.g. "US". Falls back to aiSearch when empty. */
  countryCode?: string;
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  adults?: number;
  limit?: number;
};

export type LiveHotelRow = {
  id: number;
  name: string;
  city: string;
  country: string;
  star_rating: number;
  guest_rating: number;
  reviews_count: number;
  price_per_night: number;
  image_url: string;
  amenities: string[];
  provider: string;
};

type LiteRate = {
  boardName?: string;
  retailRate?: { total?: { amount?: number; currency?: string }[] };
};

type LiteSearchResponse = {
  data?: {
    hotelId: string;
    roomTypes?: { rates?: LiteRate[] }[];
  }[];
  hotels?: {
    id: string;
    name: string;
    main_photo?: string;
    address?: string;
    country_code?: string;
    city_name?: string;
    rating?: number;
    stars?: number;
    review_count?: number;
  }[];
};

function nightsBetween(checkin: string, checkout: string): number {
  const a = Date.parse(`${checkin}T00:00:00Z`);
  const b = Date.parse(`${checkout}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Search live hotel rates and upsert them into the local hotels table so the
 * rest of the app (detail pages, bookings, admin) works unchanged.
 * Returns the local DB rows for the hotels that had a live rate, cheapest first.
 */
export async function searchLiveHotels(s: LiveSearch): Promise<LiveHotelRow[]> {
  const key = process.env.LITEAPI_KEY;
  if (!key) throw new Error("LITEAPI_KEY is not configured");

  const limit = Math.min(Math.max(s.limit ?? 12, 1), 50);
  const body: Record<string, unknown> = {
    checkin: s.checkin,
    checkout: s.checkout,
    currency: "USD",
    guestNationality: "US",
    occupancies: [{ rooms: 1, adults: Math.min(Math.max(s.adults ?? 2, 1), 8) }],
    limit,
    maxRatesPerHotel: 1,
    timeout: 12,
  };
  const cc = (s.countryCode ?? "").trim().toUpperCase();
  if (cc.length === 2) {
    body.countryCode = cc;
    body.cityName = s.cityName;
  } else {
    body.aiSearch = s.cityName;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let payload: LiteSearchResponse;
  try {
    const res = await fetch(`${LITEAPI_BASE}/hotels/rates`, {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`liteAPI ${res.status}: ${text.slice(0, 200)}`);
    }
    payload = (await res.json()) as LiteSearchResponse;
  } finally {
    clearTimeout(timer);
  }

  const meta = new Map<string, NonNullable<LiteSearchResponse["hotels"]>[number]>();
  for (const h of payload.hotels ?? []) meta.set(h.id, h);

  // Cheapest live rate per hotel
  const cheapest = new Map<string, { amount: number; boardName?: string }>();
  for (const d of payload.data ?? []) {
    const total = d.roomTypes?.[0]?.rates?.[0]?.retailRate?.total?.[0];
    if (!total || typeof total.amount !== "number" || total.currency !== "USD") continue;
    const prev = cheapest.get(d.hotelId);
    if (!prev || total.amount < prev.amount) {
      cheapest.set(d.hotelId, {
        amount: total.amount,
        boardName: d.roomTypes?.[0]?.rates?.[0]?.boardName,
      });
    }
  }

  const nights = nightsBetween(s.checkin, s.checkout);
  const rows: LiveHotelRow[] = [];

  for (const [hotelId, rate] of cheapest) {
    const m = meta.get(hotelId);
    if (!m?.name) continue;
    const perNight = Math.max(1, Math.round((rate.amount / nights) * 100) / 100);
    const amenities = rate.boardName && rate.boardName.toLowerCase() !== "room only"
      ? [rate.boardName]
      : [];
    const dbRows = await query<{
      id: number;
      name: string;
      city: string;
      country: string;
      star_rating: number;
      guest_rating: number;
      reviews_count: number;
      price_per_night: number;
      image_url: string;
      amenities: string[];
      provider: string;
    }>(
      `INSERT INTO hotels (name, city, country, address, star_rating, guest_rating,
         reviews_count, price_per_night, image_url, amenities, provider, provider_hotel_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (provider_hotel_id) DO UPDATE SET
         name = EXCLUDED.name,
         city = EXCLUDED.city,
         country = EXCLUDED.country,
         address = EXCLUDED.address,
         star_rating = EXCLUDED.star_rating,
         guest_rating = EXCLUDED.guest_rating,
         reviews_count = EXCLUDED.reviews_count,
         price_per_night = EXCLUDED.price_per_night,
         image_url = EXCLUDED.image_url,
         amenities = EXCLUDED.amenities
       RETURNING id, name, city, country, star_rating, guest_rating, reviews_count,
         price_per_night, image_url, amenities, provider`,
      [
        m.name,
        m.city_name || s.cityName,
        m.country_code || cc || "",
        m.address || "",
        Math.round(clamp(Number(m.stars) || 3, 1, 5)),
        clamp(Number(m.rating) || 8, 0, 9.9),
        Math.max(0, Math.round(Number(m.review_count) || 0)),
        perNight,
        m.main_photo || "",
        amenities,
        "Nuitee Connect",
        hotelId,
      ]
    );
    if (dbRows[0]) rows.push(dbRows[0]);
  }

  rows.sort((a, b) => a.price_per_night - b.price_per_night);
  return rows;
}

/**
 * Fetch a hotel's contact details (phone/email) from the static hotel-data
 * endpoint. Cheap (~100-300ms), so it is fine for the recommended few.
 */
export async function getHotelContact(
  hotelId: string
): Promise<{ phone?: string; email?: string }> {
  const key = process.env.LITEAPI_KEY;
  if (!key) return {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      `${LITEAPI_BASE}/data/hotel?hotelId=${encodeURIComponent(hotelId)}`,
      { headers: { "X-API-Key": key }, signal: controller.signal }
    );
    if (!res.ok) return {};
    const data = ((await res.json()) as { data?: Record<string, unknown> })?.data ?? {};
    return {
      phone: typeof data.phone === "string" && data.phone ? data.phone : undefined,
      email: typeof data.email === "string" && data.email ? data.email : undefined,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}
