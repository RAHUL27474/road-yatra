import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";

export const AUTH_COOKIE = "ry_token";
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export type SessionUser = { id: string; name: string; email: string | null; phone: string; role: string };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: Record<string, unknown>, expiresIn = "30d") {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(secret);
}

export async function verifyToken<T = Record<string, unknown>>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as T;
  } catch {
    return null;
  }
}

async function userFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const payload = await verifyToken<{ sub?: string; typ?: string }>(token);
  if (!payload?.sub || payload.typ !== "session") return null;
  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
}

/** For API routes: accepts a Bearer token (mobile app) or the session cookie (website). */
export async function getRequestUser(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return userFromToken(header.slice(7));
  return userFromToken((await cookies()).get(AUTH_COOKIE)?.value);
}

/** For server components and server actions. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return userFromToken((await cookies()).get(AUTH_COOKIE)?.value);
}

export async function createSessionToken(userId: string) {
  return signToken({ sub: userId, typ: "session" });
}
