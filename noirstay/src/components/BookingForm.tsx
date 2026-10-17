"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function BookingForm({
  hotelId,
  pricePerNight,
  signedIn,
  defaultCheckIn,
  defaultCheckOut,
}: {
  hotelId: number;
  pricePerNight: number;
  signedIn: boolean;
  defaultCheckIn: string;
  defaultCheckOut: string;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [roomType, setRoomType] = useState("Standard King");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const nights = useMemo(() => {
    const n = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [checkIn, checkOut]);
  const total = (nights * pricePerNight * rooms).toFixed(2);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedIn) {
      router.push(`/login?next=/hotels/${hotelId}`);
      return;
    }
    if (nights < 1) {
      setStatus({ kind: "err", msg: "Check-out must be after check-in." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotel_id: hotelId, check_in: checkIn, check_out: checkOut, guests, rooms, room_type: roomType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "err", msg: data.error || "Booking failed." });
      } else {
        setStatus({
          kind: "ok",
          msg: `Booked! ${nights} night${nights > 1 ? "s" : ""} confirmed — total $${total}. Manage it from your dashboard.`,
        });
        router.refresh();
      }
    } catch {
      setStatus({ kind: "err", msg: "Connection lost — please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-zinc-800 bg-black/70 p-5"
    >
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-semibold text-white">
          ${pricePerNight}
          <span className="text-sm font-normal text-zinc-500"> / night</span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">Check-in</label>
          <input
            type="date"
            value={checkIn}
            min={defaultCheckIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">Check-out</label>
          <input
            type="date"
            value={checkOut}
            min={checkIn}
            onChange={(e) => setCheckOut(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">Guests</label>
          <input
            type="number"
            min={1}
            max={8}
            value={guests}
            onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">Rooms</label>
          <select
            value={rooms}
            onChange={(e) => setRooms(Number(e.target.value))}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">Room type</label>
        <select
          value={roomType}
          onChange={(e) => setRoomType(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
        >
          {["Standard King", "Deluxe Queen", "Executive Suite", "Junior Suite"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-1 border-t border-zinc-800 pt-4 text-sm text-zinc-400">
        <div className="flex justify-between">
          <span>
            ${pricePerNight} × {nights} night{nights > 1 ? "s" : ""} × {rooms} room{rooms > 1 ? "s" : ""}
          </span>
          <span>${total}</span>
        </div>
        <div className="flex justify-between font-semibold text-white">
          <span>Total</span>
          <span>${total}</span>
        </div>
      </div>

      {status && (
        <p
          className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
            status.kind === "ok"
              ? "border-zinc-600 bg-zinc-900 text-zinc-100"
              : "border-zinc-700 bg-zinc-900 text-zinc-300"
          }`}
        >
          {status.msg}{" "}
          {status.kind === "ok" && (
            <Link href="/dashboard/bookings" className="underline underline-offset-4">
              View bookings
            </Link>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 h-11 w-full rounded-lg bg-white text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
      >
        {busy ? "Booking…" : signedIn ? "Book this stay" : "Sign in to book"}
      </button>
    </form>
  );
}
