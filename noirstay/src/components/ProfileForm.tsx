"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileForm({
  user,
}: {
  user: { name: string; email: string; phone: string | null; created_at: string; role: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "err", msg: data.error || "Could not save." });
      } else {
        setStatus({ kind: "ok", msg: "Profile saved." });
        setCurrentPassword("");
        setNewPassword("");
        router.refresh();
      }
    } catch {
      setStatus({ kind: "err", msg: "Connection lost — please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-6">
      <div className="grid gap-4 rounded-xl border border-zinc-800 bg-black/60 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">Email</label>
          <input
            value={user.email}
            disabled
            className="h-10 w-full cursor-not-allowed rounded-lg border border-zinc-800/60 bg-zinc-950/60 px-3 text-sm text-zinc-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 0100"
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-800 bg-black/60 p-6 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm font-medium text-white">Change password</p>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">
            Current password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-500">
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Leave blank to keep current"
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      {status && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            status.kind === "ok"
              ? "border-zinc-600 bg-zinc-900 text-zinc-100"
              : "border-zinc-700 bg-zinc-900 text-zinc-300"
          }`}
        >
          {status.msg}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
