"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/types";

const statusStyle: Record<string, string> = {
  pending: "border-zinc-600 text-zinc-300",
  confirmed: "border-zinc-400 text-white",
  completed: "border-zinc-700 text-zinc-400",
  cancelled: "border-zinc-800 text-zinc-600 line-through",
};

export default function BookingsList() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/bookings");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load bookings.");
        setBookings([]);
        return;
      }
      setBookings(data.bookings);
    } catch {
      setError("Connection lost — please refresh.");
      setBookings([]);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/bookings")
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

  async function cancel(id: number) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not cancel this booking.");
      } else {
        setError("");
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  if (bookings === null) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
          {error}
        </p>
      )}
      {bookings.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-black/50 py-20 text-center">
          <p className="text-zinc-300">You have no bookings yet.</p>
          <Link
            href="/hotels"
            className="mt-4 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
          >
            Browse hotels
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const cancellable =
              (b.status === "confirmed" || b.status === "pending") &&
              new Date(b.check_in) >= new Date(new Date().toDateString());
            return (
              <li
                key={b.id}
                className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-black/60 p-5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/hotels/${b.hotel_id}`}
                      className="font-medium text-white hover:underline hover:underline-offset-4"
                    >
                      {b.hotel_name}
                    </Link>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${statusStyle[b.status] ?? statusStyle.pending}`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {b.hotel_city}, {b.hotel_country} · {b.room_type} · {b.guests} guest
                    {b.guests > 1 ? "s" : ""} · {b.rooms} room{b.rooms > 1 ? "s" : ""}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {new Date(b.check_in).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    →{" "}
                    {new Date(b.check_out).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {b.nights} night{b.nights > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <span className="text-lg font-semibold text-white">
                    ${Number(b.total_price).toLocaleString()}
                  </span>
                  {cancellable && (
                    <button
                      onClick={() => void cancel(b.id)}
                      disabled={busyId === b.id}
                      className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-50"
                    >
                      {busyId === b.id ? "Cancelling…" : "Cancel booking"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
