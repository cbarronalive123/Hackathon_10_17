import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-black/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 font-mono text-sm font-bold text-white">
            N
          </span>
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-white">
            Noirstay
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/hotels"
            className="rounded px-3 py-2 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            Hotels
          </Link>
          {user ? (
            <Link
              href={user.role === "admin" ? "/admin" : "/dashboard"}
              className="rounded border border-zinc-700 bg-white px-4 py-2 font-medium text-black transition-colors hover:bg-zinc-200"
            >
              {user.role === "admin" ? "Admin Portal" : "My Dashboard"}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded px-3 py-2 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded border border-zinc-700 bg-white px-4 py-2 font-medium text-black transition-colors hover:bg-zinc-200"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
