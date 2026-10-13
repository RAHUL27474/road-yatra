import { z } from "zod";
import { db } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";
import { phoneSchema } from "@/lib/schemas";
import { sessionResponse } from "@/lib/session";

const schema = z.object({
  phone: phoneSchema,
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
  name: z.string().trim().min(2, "Enter your full name").optional(),
});

// POST /api/auth/otp/verify { phone, otp, name? } -> { token, user } | { needsName: true }
export const POST = handle(async (req: Request) => {
  const { phone, otp, name } = schema.parse(await req.json());
  let user = await db.user.findUnique({ where: { phone } });
  // New customers must give their name; ask before using up the OTP.
  if (!user && !name) return ok({ needsName: true });
  await verifyOtp(phone, otp);
  user ??= await db.user.create({ data: { phone, name: name! } });
  return sessionResponse(user);
});
