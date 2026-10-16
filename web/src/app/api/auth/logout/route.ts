import { AUTH_COOKIE, getRequestUser, revokeTokens } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function POST(req: Request) {
  // The mobile apps send a Bearer token: revoke it on the server too, not just forget it on the phone.
  if (req.headers.get("authorization")?.startsWith("Bearer ")) {
    const user = await getRequestUser(req);
    if (user) await revokeTokens(user.id);
  }
  const res = ok({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
