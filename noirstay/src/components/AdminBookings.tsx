"use client";

import { useCallback, useEffect, useState } from "react";
import type { Booking } from "@/lib/types";

const STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;

const statusStyle: Record<string, string> = {
  pending: "border-zinc-600 text-zinc-300",
  confirmed: "border-zinc-400 text-white",
  completed: "border-zinc-700 text-zinc-400",
  cancelled: "border-zinc-800 text-zinc-600",
};

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings?scope=all");
      const data = await res.json();
      if (res.ok) {
        setBookings(data.bookings);
      } else {
        setError(data.error || "Could not load bookings.");
        setBookings([]);
      }
    } catch {
      setError("Connection lost — please refresh.");
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/bookings?scope=all")
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          setBookings(data.bookings);
        } else {
          setError(data.error || "Could not load bookings.");
          setBookings([]);
        }
      })
      .catch(() => {
        if (active) {
          setError("Connection lost — please refresh.");
          setBookings([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function setStatus(id: number, status: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update.");
      } else {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Permanently delete this booking?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  const filtered = (bookings ?? []).filter((b) => !filter || b.status === filter);
  const revenue = filtered
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + Number(b.total_price), 0);

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{error}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("")}
            className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
              filter === "" ? "border-zinc-400 bg-zinc-100 text-black" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg border px-3.5 py-2 text-xs font-medium capitalize transition-colors ${
                filter === s ? "border-zinc-400 bg-zinc-100 text-black" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-sm text-zinc-400">
          {filtered.length} booking{filtered.length === 1 ? "" : "s"} · revenue{" "}
          <span className="font-semibold text-white">${revenue.toLocaleString()}</span>
        </p>
      </div>

      {bookings === null ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-left text-xs uppercase tracking-widest text-zinc-500">
                <th className="px-4 py-3 font-normal">Guest</th>
                <th className="px-4 py-3 font-normal">Hotel</th>
                <th className="px-4 py-3 font-normal">Stay</th>
                <th className="px-4 py-3 font-normal">Rooms</th>
                <th className="px-4 py-3 font-normal">Total</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-950/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{b.user_name}</p>
                    <p className="text-xs text-zinc-500">{b.user_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-zinc-200">{b.hotel_name}</p>
                    <p className="text-xs text-zinc-500">{b.hotel_city}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(b.check_in).toLocaleDateString()} → {new Date(b.check_out).toLocaleDateString()}
                    <span className="ml-1 text-xs text-zinc-600">({b.nights}n)</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {b.rooms} × {b.room_type}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">${Number(b.total_price).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${statusStyle[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={b.status}
                        disabled={busyId === b.id}
                        onChange={(e) => void setStatus(b.id, e.target.value)}
                        className="h-8 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => void remove(b.id)}
                        disabled={busyId === b.id}
                        className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    No bookings found.
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
