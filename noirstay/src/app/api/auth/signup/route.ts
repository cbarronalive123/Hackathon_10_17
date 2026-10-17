import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { createSession, hashPassword, isEmail } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const phone = String(body.phone ?? "").trim() || null;

    if (name.length < 2) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    if (!isEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const existing = await one("SELECT id FROM users WHERE email = $1", [email]);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await one<{ id: number; name: string; email: string; role: string }>(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, 'customer') RETURNING id, name, email, role`,
      [name, email, passwordHash, phone]
    );

    await createSession({ id: user!.id, name: user!.name, email: user!.email, role: "customer" });
    return NextResponse.json({ user, redirect: "/dashboard" });
  } catch (err) {
    console.error("signup error", err);
    return NextResponse.json({ error: "Could not create your account." }, { status: 500 });
  }
}
