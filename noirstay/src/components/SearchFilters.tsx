"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const cities = [
  "New York", "Paris", "London", "Tokyo", "Dubai", "Rome",
  "Barcelona", "Singapore", "Amsterdam", "Toronto", "Las Vegas", "Miami",
];

export default function SearchFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [city, setCity] = useState(params.get("city") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") ?? "");
  const [minStars, setMinStars] = useState(params.get("minStars") ?? "");
  const [sort, setSort] = useState(params.get("sort") ?? "recommended");

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (city) next.set("city", city);
    if (maxPrice) next.set("maxPrice", maxPrice);
    if (minStars) next.set("minStars", minStars);
    if (sort !== "recommended") next.set("sort", sort);
    router.push(`/hotels${next.toString() ? `?${next.toString()}` : ""}`);
  }

  function reset() {
    setQ("");
    setCity("");
    setMaxPrice("");
    setMinStars("");
    setSort("recommended");
    router.push("/hotels");
  }

  return (
    <form
      onSubmit={apply}
      className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-800 bg-black/60 p-4 sm:grid-cols-2 lg:grid-cols-12"
    >
      <div className="lg:col-span-4">
        <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">
          Search
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hotel, city or country"
          className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div className="lg:col-span-3">
        <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">
          City
        </label>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2">
        <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">
          Max price / night
        </label>
        <input
          type="number"
          min="1"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="$ any"
          className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div className="lg:col-span-1">
        <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">
          Stars
        </label>
        <select
          value={minStars}
          onChange={(e) => setMinStars(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
        >
          <option value="">Any</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
          <option value="5">5</option>
        </select>
      </div>
      <div className="lg:col-span-2">
        <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">
          Sort
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
        >
          <option value="recommended">Recommended</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Guest rating</option>
          <option value="stars">Stars</option>
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-12">
        <button
          type="submit"
          className="h-10 flex-1 rounded-lg bg-white text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
        >
          Search hotels
        </button>
        <button
          type="button"
          onClick={reset}
          className="h-10 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
