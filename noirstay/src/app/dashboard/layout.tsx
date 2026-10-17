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
    href: "/dashboard",
    label: "Overview",
    icon: icon(
      <>
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </>
    ),
  },
  {
    href: "/dashboard/bookings",
    label: "My Bookings",
    icon: icon(
      <>
        <path d="M3 8h18v13H3z" />
        <path d="M8 8V4h8v4" />
      </>
    ),
  },
  {
    href: "/dashboard/profile",
    label: "Profile",
    icon: icon(
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "customer") redirect("/admin");

  return (
    <div className="flex min-h-screen">
      <DashSidebar portal="Customer Portal" items={items} user={{ name: user.name, email: user.email }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader items={items} fallback="Customer Portal" />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
