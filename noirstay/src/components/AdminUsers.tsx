"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  created_at: string;
  booking_count: number;
  total_spend: string;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setUsers(data.users);
        } else {
          setError(data.error || "Could not load users.");
          setUsers([]);
        }
      })
      .catch(() => {
        setError("Connection lost — please refresh.");
        setUsers([]);
      });
  }, []);

  const filtered = (users ?? []).filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{error}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="h-10 w-full max-w-xs rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
        <p className="text-sm text-zinc-400">
          {filtered.length} account{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {users === null ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-left text-xs uppercase tracking-widest text-zinc-500">
                <th className="px-4 py-3 font-normal">User</th>
                <th className="px-4 py-3 font-normal">Phone</th>
                <th className="px-4 py-3 font-normal">Role</th>
                <th className="px-4 py-3 font-normal">Joined</th>
                <th className="px-4 py-3 font-normal">Bookings</th>
                <th className="px-4 py-3 text-right font-normal">Total spend</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-950/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{u.name}</p>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{u.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${
                        u.role === "admin" ? "border-zinc-400 text-white" : "border-zinc-700 text-zinc-400"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(u.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{u.booking_count}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    ${Number(u.total_spend).toLocaleString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No users match.
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
