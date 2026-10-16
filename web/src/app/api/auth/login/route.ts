import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { handle, HttpError } from "@/lib/http";
import { sessionResponse } from "@/lib/session";

const schema = z.object({
  login: z.string().trim().min(1, "Enter your email or mobile number"),
  password: z.string().min(1, "Enter your password"),
});

/** "98765 43210", "+91 98765 43210", "098765 43210" → "9876543210", so a typed mobile number always matches. */
function asPhone(login: string) {
  const digits = login.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.length === 10 ? digits : login;
}

export const POST = handle(async (req: Request) => {
  const { login, password } = schema.parse(await req.json());
  const phone = login.includes("@") ? login : asPhone(login);
  const user = await db.user.findFirst({ where: { OR: [{ email: login.toLowerCase() }, { phone }] } });
  if (user && !user.passwordHash) throw new HttpError(400, "This account has no password. Please log in with an OTP.");
  if (!user || !(await verifyPassword(password, user.passwordHash!))) throw new HttpError(401, "Incorrect email/mobile or password.");
  return sessionResponse(user);
});
