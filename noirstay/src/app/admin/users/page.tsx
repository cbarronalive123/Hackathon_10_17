import AdminUsers from "@/components/AdminUsers";

export const metadata = { title: "Users" };

export default function AdminUsersPage() {
  return (
    <div>
      <p className="mb-6 text-sm text-zinc-500">
        Everyone with a NoirStay account — customers and admins.
      </p>
      <AdminUsers />
    </div>
  );
}
