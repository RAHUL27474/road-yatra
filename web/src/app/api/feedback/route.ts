import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";

const schema = z.object({
  rating: z.number().int().min(1, "Choose 1 to 5 stars").max(5),
  comment: z.string().trim().max(1000).optional(),
  name: z.string().trim().max(80).optional(),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")]).optional(),
  bookingCode: z.string().trim().max(20).optional(),
  source: z.enum(["WEB", "APP"]).default("WEB"),
});

// POST /api/feedback { rating 1-5, comment?, name?, phone?, bookingCode? } -> anyone; logged-in users are linked
export const POST = handle(async (req: Request) => {
  const user = await getRequestUser(req);
  const data = schema.parse(await req.json());
  const phone = data.phone || user?.phone || "";
  // A light brake on spam: at most 5 feedbacks an hour per account / number.
  if (user || phone) {
    const recent = await db.feedback.count({
      where: { createdAt: { gt: new Date(Date.now() - 3600_000) }, OR: [...(user ? [{ userId: user.id }] : []), ...(phone ? [{ phone }] : [])] },
    });
    if (recent >= 5) throw new HttpError(429, "Thank you — we already have your feedback. Please try again later.");
  }
  await db.feedback.create({
    data: {
      userId: user?.id ?? null,
      name: data.name || user?.name || "",
      phone,
      rating: data.rating,
      comment: data.comment ?? "",
      bookingCode: data.bookingCode?.toUpperCase() || null,
      source: data.source,
    },
  });
  return ok({ ok: true }, 201);
});
