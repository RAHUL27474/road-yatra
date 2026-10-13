import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { handle, HttpError } from "@/lib/http";
import { phoneSchema } from "@/lib/schemas";
import { sessionResponse } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("").transform(() => undefined)),
  phone: phoneSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const POST = handle(async (req: Request) => {
  const data = schema.parse(await req.json());
  const exists = await db.user.findFirst({ where: { OR: [{ phone: data.phone }, ...(data.email ? [{ email: data.email }] : [])] } });
  if (exists) throw new HttpError(409, "An account with this mobile number or email already exists. Please log in.");
  const user = await db.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, passwordHash: await hashPassword(data.password) },
  });
  return sessionResponse(user, 201);
});
