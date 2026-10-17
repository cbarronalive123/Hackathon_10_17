"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { NavItem } from "./DashSidebar";

export default function PageHeader({
  items,
  fallback,
  children,
}: {
  items: NavItem[];
  fallback: string;
  children?: ReactNode;
}) {
  const pathname = usePathname();

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

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-800 bg-black/80 px-6 backdrop-blur">
      <h1 className="truncate text-lg font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}
