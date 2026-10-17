"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create your account.");
        setBusy(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Connection lost — please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-black/70 p-8">
      <h1 className="text-2xl font-semibold text-white">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Book hotels, track your stays, and talk to the concierge.
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        {error && (
          <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs uppercase tracking-widest text-zinc-500">
            Full name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={set("name")}
            placeholder="Jordan Miles"
            className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs uppercase tracking-widest text-zinc-500">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@example.com"
            className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-xs uppercase tracking-widest text-zinc-500">
            Phone <span className="normal-case tracking-normal text-zinc-600">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={set("phone")}
            placeholder="+1 555 0100"
            className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs uppercase tracking-widest text-zinc-500">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            placeholder="At least 8 characters"
            className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-lg bg-white text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-zinc-200 underline underline-offset-4 hover:text-white">
          Sign in
        </Link>
      </p>
    </div>
  );
}
