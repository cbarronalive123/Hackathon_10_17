import { redirect } from "next/navigation";
import SignupForm from "@/components/SignupForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-zinc-500">
          Noirstay
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Join NoirStay</h1>
      </div>
      <SignupForm />
    </main>
  );
}
