"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busyPortal, setBusyPortal] = useState<"customer" | "admin" | null>(null);

  async function submit(portal: "customer" | "admin") {
    setError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusyPortal(portal);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not sign you in.");
        setBusyPortal(null);
        return;
      }
      router.push(data.redirect);
      router.refresh();
    } catch {
      setError("Connection lost — please try again.");
      setBusyPortal(null);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-black/70 p-8">
      <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Sign in to your NoirStay account to continue.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit("customer");
        }}
      >
        {error && (
          <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs uppercase tracking-widest text-zinc-500">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={busyPortal !== null}
          className="h-11 w-full rounded-lg bg-white text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {busyPortal === "customer" ? "Signing in…" : "Sign in — Customer Portal"}
        </button>
        <button
          type="button"
          disabled={busyPortal !== null}
          onClick={() => void submit("admin")}
          className="h-11 w-full rounded-lg border border-zinc-700 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-400 hover:bg-zinc-900 disabled:opacity-50"
        >
          {busyPortal === "admin" ? "Signing in…" : "Sign in — Admin Portal"}
        </button>
      </form>

      <div className="mt-6 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">Demo accounts</p>
        <p className="mt-2 text-xs text-zinc-400">
          Customer — <span className="font-mono text-zinc-200">guest@noirstay.com</span> /{" "}
          <span className="font-mono text-zinc-200">Guest123!</span>
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Admin — <span className="font-mono text-zinc-200">admin@noirstay.com</span> /{" "}
          <span className="font-mono text-zinc-200">Admin123!</span>
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        New to NoirStay?{" "}
        <Link href="/signup" className="text-zinc-200 underline underline-offset-4 hover:text-white">
          Create an account
        </Link>
      </p>
    </div>
  );
}
