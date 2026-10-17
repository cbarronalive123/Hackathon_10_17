import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import HotelImage from "@/components/HotelImage";
import BookingForm from "@/components/BookingForm";
import HotelCard, { Stars } from "@/components/HotelCard";
import { one, query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isoInDays } from "@/lib/dates";
import type { Hotel } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const hotel = await one<Hotel>("SELECT name, city, country FROM hotels WHERE id = $1", [Number(id)]);
  return { title: hotel ? `${hotel.name} — ${hotel.city}` : "Hotel" };
}

export default async function HotelDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const hotelId = Number(id);
  if (!Number.isInteger(hotelId) || hotelId <= 0) notFound();

  const hotel = await one<Hotel>("SELECT * FROM hotels WHERE id = $1", [hotelId]);
  if (!hotel) notFound();

  const session = await getCurrentUser();
  const nearby = await query<Hotel>(
    "SELECT * FROM hotels WHERE city = $1 AND id <> $2 ORDER BY guest_rating DESC LIMIT 3",
    [hotel.city, hotelId]
  );

  const defaultCheckIn = isoInDays(1);
  const defaultCheckOut = isoInDays(3);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/hotels" className="text-sm text-zinc-500 transition-colors hover:text-zinc-200">
          ← All hotels
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <HotelImage
                src={hotel.image_url}
                alt={hotel.name}
                className="aspect-[16/9] w-full object-cover"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold text-white">{hotel.name}</h1>
                  <Stars n={hotel.star_rating} />
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  {hotel.address ? `${hotel.address} · ` : ""}
                  {hotel.city}, {hotel.country}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Listed by <span className="text-zinc-400">{hotel.provider}</span>
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-black/60 px-4 py-2 text-sm">
                <span className="font-semibold text-white">{hotel.guest_rating.toFixed(1)}</span>
                <span className="text-zinc-500"> / 10 · </span>
                <span className="text-zinc-400">{hotel.reviews_count.toLocaleString()} reviews</span>
              </div>
            </div>

            {hotel.amenities.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {hotel.amenities.map((a) => (
                  <span
                    key={a}
                    className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-8">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                About this stay
              </h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-zinc-300">
                {hotel.description}
              </p>
            </div>

            {nearby.length > 0 && (
              <div className="mt-12">
                <h2 className="text-lg font-semibold text-white">
                  More in {hotel.city}
                </h2>
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {nearby.map((h) => (
                    <HotelCard key={h.id} hotel={h} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <BookingForm
              hotelId={hotel.id}
              pricePerNight={Number(hotel.price_per_night)}
              signedIn={Boolean(session)}
              defaultCheckIn={defaultCheckIn}
              defaultCheckOut={defaultCheckOut}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
