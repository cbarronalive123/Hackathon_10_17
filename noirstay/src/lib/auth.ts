import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { one } from "./db";
import type { SessionUser } from "./types";

const COOKIE_NAME = "noirstay_session";
const SESSION_DAYS = 7;

function secret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    sub: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: Number(payload.sub),
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      role: payload.role === "admin" ? "admin" : "customer",
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const row = await one<{
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role: "customer" | "admin";
    created_at: Date;
  }>("SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1", [
    session.id,
  ]);
  if (!row) return null;
  return { ...row, created_at: row.created_at.toISOString() };
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
