import type { User } from "@prisma/client";
import { AUTH_COOKIE, createSessionToken } from "./auth";
import { ok } from "./http";

/** JSON { token, user } plus the website session cookie. */
export async function sessionResponse(user: User, status = 200) {
  const token = await createSessionToken(user.id);
  const res = ok({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } }, status);
  res.cookies.set(AUTH_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: process.env.APP_URL?.startsWith("https") });
  return res;
}
