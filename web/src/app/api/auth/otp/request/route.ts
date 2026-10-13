import { z } from "zod";
import { db } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import { requestOtp } from "@/lib/otp";
import { phoneSchema } from "@/lib/schemas";

// POST /api/auth/otp/request { phone } -> { isNewUser, devOtp? }
export const POST = handle(async (req: Request) => {
  const { phone } = z.object({ phone: phoneSchema }).parse(await req.json());
  const { devOtp } = await requestOtp(phone);
  const isNewUser = !(await db.user.findUnique({ where: { phone }, select: { id: true } }));
  return ok({ sent: true, isNewUser, devOtp });
});
