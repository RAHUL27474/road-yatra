import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { handle, HttpError } from "@/lib/http";
import { sessionResponse } from "@/lib/session";

const schema = z.object({
  login: z.string().trim().min(1, "Enter your email or mobile number"),
  password: z.string().min(1, "Enter your password"),
});

export const POST = handle(async (req: Request) => {
  const { login, password } = schema.parse(await req.json());
  const user = await db.user.findFirst({ where: { OR: [{ email: login.toLowerCase() }, { phone: login }] } });
  if (user && !user.passwordHash) throw new HttpError(400, "This account has no password. Please log in with an OTP.");
  if (!user || !(await verifyPassword(password, user.passwordHash!))) throw new HttpError(401, "Incorrect email/mobile or password.");
  return sessionResponse(user);
});
