import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import HotelCard from "@/components/HotelCard";
import VoiceChat from "@/components/VoiceChat";
import { query } from "@/lib/db";
import type { Hotel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featured = await query<Hotel>(
    "SELECT * FROM hotels WHERE featured = TRUE ORDER BY guest_rating DESC LIMIT 6"
  );
  const [counts] = await query<{ hotels: number; cities: number; countries: number }>(
    `SELECT
      (SELECT count(*)::int FROM hotels) AS hotels,
      (SELECT count(Distinct city)::int FROM hotels) AS cities,
      (SELECT count(Distinct country)::int FROM hotels) AS countries`
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero + voice concierge */}
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Hotel aggregator
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Every stay.
              <br />
              One search.
              <br />
              <span className="text-zinc-500">Just say the word.</span>
            </h1>
            <p className="mt-6 max-w-md text-zinc-400">
              NoirStay aggregates hotels from providers worldwide and lets you find your
              next stay by simply talking. Speak to the concierge, compare options, and
              book in seconds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/hotels"
                className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
              >
                Browse hotels
              </Link>
              <Link
                href="/signup"
                className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-400 hover:bg-zinc-900"
              >
                Create account
              </Link>
            </div>
            <dl className="mt-10 flex gap-8 text-sm">
              <div>
                <dt className="text-zinc-500">Hotels</dt>
                <dd className="mt-1 text-2xl font-semibold text-white">{counts.hotels}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Cities</dt>
                <dd className="mt-1 text-2xl font-semibold text-white">{counts.cities}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Countries</dt>
                <dd className="mt-1 text-2xl font-semibold text-white">{counts.countries}</dd>
              </div>
            </dl>
          </div>
          <VoiceChat />
        </section>

        {/* How it works */}
        <section className="border-t border-zinc-800/60">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Say what you need",
                body: "Tap the mic and speak naturally — city, budget, dates, vibe. The concierge listens and understands.",
              },
              {
                step: "02",
                title: "Compare every option",
                body: "NoirStay aggregates hotels across providers so you see the full picture — rates, ratings, amenities.",
              },
              {
                step: "03",
                title: "Book and manage",
                body: "Reserve instantly and track every stay from your dashboard. Plans change? Cancel in one click.",
              },
            ].map((s) => (
              <div key={s.step} className="rounded-xl border border-zinc-800 bg-black/50 p-6">
                <p className="font-mono text-xs tracking-[0.3em] text-zinc-600">{s.step}</p>
                <h3 className="mt-3 font-medium text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Featured hotels */}
        <section className="border-t border-zinc-800/60">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-zinc-500">
                  Handpicked
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Featured stays</h2>
              </div>
              <Link
                href="/hotels"
                className="text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                View all hotels →
              </Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((h) => (
                <HotelCard key={h.id} hotel={h} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-zinc-600 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} NoirStay — every stay, one search.</p>
          <p className="font-mono tracking-widest">VOICE · SEARCH · BOOK</p>
        </div>
      </footer>
    </div>
  );
}
