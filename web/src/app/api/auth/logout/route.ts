import { AUTH_COOKIE } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function POST() {
  const res = ok({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
