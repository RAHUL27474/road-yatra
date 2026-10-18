import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";
import { jwtSecret } from "./secret";

export const AUTH_COOKIE = "ry_token";
const secret = () => new TextEncoder().encode(jwtSecret());

export type SessionUser = { id: string; name: string; email: string | null; phone: string; role: string };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: Record<string, unknown>, expiresIn = "30d") {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(secret());
}

export async function verifyToken<T = Record<string, unknown>>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as T;
  } catch {
    return null;
  }
}

/** `app`: a Bearer token from a mobile app, which an app logout revokes (website cookies are not affected). */
async function userFromToken(token: string | undefined | null, app = false): Promise<SessionUser | null> {
  if (!token) return null;
  const payload = await verifyToken<{ sub?: string; typ?: string; tv?: number; sv?: number }>(token);
  if (!payload?.sub || payload.typ !== "session") return null;
  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;
  // App tokens issued before an app logout carry an older version and stop working.
  if (app && (payload.tv ?? 0) !== user.tokenVersion) return null;
  // Website cookies end when the password changes or the office removes access.
  if (!app && (payload.sv ?? 0) !== user.sessionVersion) return null;
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
}

/** For API routes: accepts a Bearer token (mobile app) or the session cookie (website). */
export async function getRequestUser(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return userFromToken(header.slice(7), true);
  return userFromToken((await cookies()).get(AUTH_COOKIE)?.value);
}

/** For server components and server actions. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return userFromToken((await cookies()).get(AUTH_COOKIE)?.value);
}

export async function createSessionToken(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { tokenVersion: true, sessionVersion: true } });
  return signToken({ sub: userId, typ: "session", tv: user?.tokenVersion ?? 0, sv: user?.sessionVersion ?? 0 });
}

/** App logout: every app (Bearer) token issued to this user so far stops working. Website sessions stay. */
export async function revokeTokens(userId: string) {
  await db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}
