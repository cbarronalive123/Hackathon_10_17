import ProfileForm from "@/components/ProfileForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = (await getCurrentUser())!;

  return (
    <div className="max-w-2xl">
      <p className="mb-6 text-sm text-zinc-500">
        Account created{" "}
        {new Date(user.created_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}{" "}
        · {user.role === "admin" ? "Administrator" : "Customer"} account
      </p>
      <ProfileForm user={user} />
    </div>
  );
}
