import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import HotelCard from "@/components/HotelCard";
import SearchFilters from "@/components/SearchFilters";
import { query } from "@/lib/db";
import type { Hotel } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Hotels" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HotelsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const search = (get("q") ?? "").trim();
  const city = get("city") ?? "";
  const maxPrice = Number(get("maxPrice")) || null;
  const minStars = Number(get("minStars")) || null;
  const sort = get("sort") ?? "recommended";

  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(name ILIKE $${params.length} OR city ILIKE $${params.length} OR country ILIKE $${params.length})`);
  }
  if (city) {
    params.push(city);
    where.push(`city = $${params.length}`);
  }
  if (maxPrice) {
    params.push(maxPrice);
    where.push(`price_per_night <= $${params.length}`);
  }
  if (minStars) {
    params.push(minStars);
    where.push(`star_rating >= $${params.length}`);
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

  const hotels = await query<Hotel>(
    `SELECT * FROM hotels WHERE ${where.join(" AND ")} ORDER BY ${orderBy}`,
    params
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-zinc-500">
          Storefront
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Find your stay</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {hotels.length} hotel{hotels.length === 1 ? "" : "s"}
          {city ? ` in ${city}` : ""}
          {search ? ` matching “${search}”` : ""}
        </p>

        <div className="mt-8">
          <Suspense fallback={<div className="h-32 rounded-xl border border-zinc-800 bg-black/60" />}>
            <SearchFilters />
          </Suspense>
        </div>

        {hotels.length === 0 ? (
          <div className="mt-16 rounded-xl border border-zinc-800 bg-black/50 py-20 text-center">
            <p className="text-zinc-300">No hotels match those filters.</p>
            <p className="mt-2 text-sm text-zinc-600">
              Try widening your search or clearing the price cap.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((h) => (
              <HotelCard key={h.id} hotel={h} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
