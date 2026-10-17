import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const portal = body.portal === "admin" ? "admin" : "customer";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await one<{
      id: number;
      name: string;
      email: string;
      role: "customer" | "admin";
      password_hash: string;
    }>("SELECT id, name, email, role, password_hash FROM users WHERE email = $1", [email]);

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (portal === "admin" && user.role !== "admin") {
      return NextResponse.json(
        { error: "This account does not have admin portal access." },
        { status: 403 }
      );
    }

    await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      redirect: portal === "admin" ? "/admin" : "/dashboard",
    });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json({ error: "Could not sign you in." }, { status: 500 });
  }
}
