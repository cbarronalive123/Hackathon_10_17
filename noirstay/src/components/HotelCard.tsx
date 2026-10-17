import Link from "next/link";
import type { Hotel } from "@/lib/types";
import HotelImage from "./HotelImage";

export function Stars({ n }: { n: number }) {
  return (
    <span className="text-xs tracking-[0.2em] text-zinc-400" title={`${n} star hotel`}>
      {"★".repeat(n)}
      <span className="text-zinc-700">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default function HotelCard({ hotel }: { hotel: Hotel }) {
  return (
    <Link
      href={`/hotels/${hotel.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60 transition-colors hover:border-zinc-600"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-zinc-800">
        <HotelImage
          src={hotel.image_url}
          alt={hotel.name}
          className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100 group-hover:scale-[1.03]"
        />
        {hotel.featured && (
          <span className="absolute left-3 top-3 rounded border border-zinc-500 bg-black/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-200">
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium leading-snug text-white group-hover:text-zinc-200">
            {hotel.name}
          </h3>
          <Stars n={hotel.star_rating} />
        </div>
        <p className="text-sm text-zinc-500">
          {hotel.city}, {hotel.country}
        </p>
        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="text-xs text-zinc-500">
            <span className="font-semibold text-zinc-300">{hotel.guest_rating.toFixed(1)}</span> / 10
            <span className="ml-1">({hotel.reviews_count.toLocaleString()} reviews)</span>
          </span>
          <span className="text-right">
            <span className="text-lg font-semibold text-white">${hotel.price_per_night}</span>
            <span className="text-xs text-zinc-500"> /night</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
