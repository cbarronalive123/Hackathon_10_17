import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const b = await req.json();
    const name = String(b.name ?? "").trim();
    const phone = String(b.phone ?? "").trim();
    const newPassword = String(b.newPassword ?? "");
    const currentPassword = String(b.currentPassword ?? "");

    if (name.length < 2) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }

    const user = await one<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [session.id]
    );
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters." },
          { status: 400 }
        );
      }
      if (!(await verifyPassword(currentPassword, user.password_hash))) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
      }
    }

    await one(
      "UPDATE users SET name = $1, phone = $2, password_hash = $3 WHERE id = $4",
      [name, phone || null, newPassword ? await hashPassword(newPassword) : user.password_hash, session.id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("profile update error", err);
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }
}
