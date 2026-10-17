"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

function titleFor(pathname: string, items: NavItem[], fallback: string) {
  let best = "";
  let title = fallback;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (item.href.length > best.length) {
        best = item.href;
        title = item.label;
      }
    }
  }
  return title;
}

export default function DashSidebar({
  portal,
  items,
  user,
}: {
  portal: string;
  items: NavItem[];
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const pageTitle = titleFor(pathname, items, portal);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-black/70">
      {/* Sidebar header — page title, reaches the top of the page */}
      <div className="border-b border-zinc-800 px-5 pb-5 pt-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 font-mono text-xs font-bold text-white">
            N
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            Noirstay
          </span>
        </Link>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          {portal}
        </p>
        <h1 className="mt-1 truncate text-xl font-semibold text-white" title={pageTitle}>
          {pageTitle}
        </h1>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-zinc-100 font-medium text-black"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              }`}
            >
              <span className={active ? "text-black" : "text-zinc-500"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="mb-3 min-w-0">
          <p className="truncate text-sm font-medium text-zinc-200">{user.name}</p>
          <p className="truncate text-xs text-zinc-600">{user.email}</p>
        </div>
        <button
          onClick={logout}
          disabled={loggingOut}
          className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-50"
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
