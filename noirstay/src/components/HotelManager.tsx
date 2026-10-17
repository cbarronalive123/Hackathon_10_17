"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import HotelImage from "./HotelImage";
import type { Hotel } from "@/lib/types";

type FormState = {
  name: string;
  city: string;
  country: string;
  address: string;
  description: string;
  star_rating: string;
  guest_rating: string;
  reviews_count: string;
  price_per_night: string;
  image_url: string;
  amenities: string;
  provider: string;
  featured: boolean;
};

const emptyForm: FormState = {
  name: "",
  city: "",
  country: "",
  address: "",
  description: "",
  star_rating: "4",
  guest_rating: "8.5",
  reviews_count: "0",
  price_per_night: "",
  image_url: "",
  amenities: "",
  provider: "NoirStay Direct",
  featured: false,
};

const inputCls =
  "h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none";
const labelCls = "mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500";

export default function HotelManager() {
  const [hotels, setHotels] = useState<Hotel[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hotels?limit=100");
      const data = await res.json();
      if (res.ok) {
        setHotels(data.hotels);
      } else {
        setError(data.error || "Could not load hotels.");
      }
    } catch {
      setError("Connection lost — please refresh.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/hotels?limit=100")
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          setHotels(data.hotels);
        } else {
          setError(data.error || "Could not load hotels.");
        }
      })
      .catch(() => {
        if (active) setError("Connection lost — please refresh.");
      });
    return () => {
      active = false;
    };
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setNotice("");
  }

  function startEdit(h: Hotel) {
    setEditingId(h.id);
    setForm({
      name: h.name,
      city: h.city,
      country: h.country,
      address: h.address,
      description: h.description,
      star_rating: String(h.star_rating),
      guest_rating: String(h.guest_rating),
      reviews_count: String(h.reviews_count),
      price_per_night: String(h.price_per_night),
      image_url: h.image_url,
      amenities: h.amenities.join(", "),
      provider: h.provider,
      featured: h.featured,
    });
    setError("");
    setNotice("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      star_rating: Number(form.star_rating),
      guest_rating: Number(form.guest_rating),
      reviews_count: Number(form.reviews_count),
      price_per_night: Number(form.price_per_night),
      amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      const res = await fetch(editingId ? `/api/hotels/${editingId}` : "/api/hotels", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save the hotel.");
      } else {
        setNotice(editingId ? "Hotel updated." : "Hotel added to the aggregator.");
        setForm(null);
        setEditingId(null);
        await load();
      }
    } catch {
      setError("Connection lost — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(h: Hotel) {
    if (!window.confirm(`Delete “${h.name}” from the aggregator?`)) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/hotels/${h.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete.");
      } else {
        setNotice("Hotel deleted.");
        await load();
      }
    } catch {
      setError("Connection lost — please try again.");
    }
  }

  const filtered = (hotels ?? []).filter((h) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      h.name.toLowerCase().includes(q) ||
      h.city.toLowerCase().includes(q) ||
      h.country.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name or city…"
          className="h-10 w-full max-w-xs rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
        <button
          onClick={startCreate}
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
        >
          + Add hotel
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{error}</p>
      )}
      {notice && (
        <p className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{notice}</p>
      )}

      {form && (
        <form
          onSubmit={submit}
          className="fade-up space-y-4 rounded-xl border border-zinc-700 bg-black/80 p-6"
        >
          <h3 className="font-medium text-white">
            {editingId ? "Edit hotel" : "New hotel"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City *</label>
              <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Country *</label>
              <input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inputCls} />
            </div>
            <div className="lg:col-span-2">
              <label className={labelCls}>Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Provider</label>
              <input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Price per night (USD) *</label>
              <input required type="number" min="1" step="1" value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Star rating (1-5)</label>
              <input type="number" min="1" max="5" value={form.star_rating} onChange={(e) => setForm({ ...form, star_rating: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Guest rating (0-10)</label>
              <input type="number" min="0" max="10" step="0.1" value={form.guest_rating} onChange={(e) => setForm({ ...form, guest_rating: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Reviews count</label>
              <input type="number" min="0" value={form.reviews_count} onChange={(e) => setForm({ ...form, reviews_count: e.target.value })} className={inputCls} />
            </div>
            <div className="lg:col-span-3">
              <label className={labelCls}>Image URL</label>
              <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" className={inputCls} />
            </div>
            <div className="lg:col-span-3">
              <label className={labelCls}>Amenities (comma separated)</label>
              <input value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} placeholder="Pool, Gym, Spa" className={inputCls} />
            </div>
            <div className="lg:col-span-3">
              <label className={labelCls}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="h-4 w-4 accent-white"
              />
              Feature on the homepage
            </label>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {busy ? "Saving…" : editingId ? "Save changes" : "Add hotel"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                setEditingId(null);
              }}
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {hotels === null ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-left text-xs uppercase tracking-widest text-zinc-500">
                <th className="px-4 py-3 font-normal">Hotel</th>
                <th className="px-4 py-3 font-normal">Location</th>
                <th className="px-4 py-3 font-normal">Stars</th>
                <th className="px-4 py-3 font-normal">Rating</th>
                <th className="px-4 py-3 font-normal">Price/night</th>
                <th className="px-4 py-3 font-normal">Provider</th>
                <th className="px-4 py-3 font-normal">Featured</th>
                <th className="px-4 py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-950/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <HotelImage src={h.image_url} alt={h.name} className="h-10 w-14 shrink-0 rounded object-cover" />
                      <Link href={`/hotels/${h.id}`} className="font-medium text-white hover:underline">
                        {h.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {h.city}, {h.country}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{h.star_rating}★</td>
                  <td className="px-4 py-3 text-zinc-300">{Number(h.guest_rating).toFixed(1)}</td>
                  <td className="px-4 py-3 font-semibold text-white">${Number(h.price_per_night).toLocaleString()}</td>
                  <td className="px-4 py-3 text-zinc-400">{h.provider}</td>
                  <td className="px-4 py-3">
                    {h.featured ? (
                      <span className="rounded-full border border-zinc-500 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-zinc-200">
                        Featured
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(h)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void remove(h)}
                        className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    No hotels match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
