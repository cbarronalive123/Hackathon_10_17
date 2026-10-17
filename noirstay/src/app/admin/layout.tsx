import { redirect } from "next/navigation";
import DashSidebar from "@/components/DashSidebar";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";

const icon = (path: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const items = [
  {
    href: "/admin",
    label: "Overview",
    icon: icon(
      <>
        <path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-4H3zM13 7h8V3h-8z" />
      </>
    ),
  },
  {
    href: "/admin/hotels",
    label: "Hotels",
    icon: icon(
      <>
        <path d="M3 21h18M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    icon: icon(
      <>
        <path d="M3 8h18v13H3z" />
        <path d="M8 8V4h8v4" />
      </>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: icon(
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 21c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
        <path d="M16 4a3.5 3.5 0 0 1 0 7" />
        <path d="M18 15.5c2.5.8 4 2.5 4 5.5" />
      </>
    ),
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      <DashSidebar portal="Admin Portal" items={items} user={{ name: user.name, email: user.email }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader items={items} fallback="Admin Portal" />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
