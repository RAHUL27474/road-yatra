import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { publicFileUrl, saveImage } from "@/lib/uploads";
import { phoneSchema } from "@/lib/schemas";

const fields = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  licenceNo: z.string().trim().toUpperCase().min(8, "Enter your driving licence number"),
  licenceExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the licence expiry date"),
  address: z.string().trim().min(5, "Enter your address"),
  experienceYears: z.coerce.number().int().min(0).max(50),
  emergencyContact: phoneSchema.or(z.literal("")).default(""),
  aadhaarLast4: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits of your Aadhaar").or(z.literal("")).default(""),
});

/**
 * POST /api/driver/apply (multipart/form-data, logged in with a verified mobile number)
 * Fields: name, licenceNo, licenceExpiry (YYYY-MM-DD), address, experienceYears, emergencyContact?, aadhaarLast4?
 * Files:  photo (required), licencePhoto (required), aadhaarPhoto (optional)
 * Creates or resubmits a PENDING application. The office approves it in Admin → Drivers.
 */
export const POST = handle(async (req: Request) => {
  // Read the upload before any check can refuse it: answering while the multipart body is unread makes Next.js fail with a 500.
  let upload: FormData | null = null;
  try {
    upload = await req.formData();
  } catch {
    // reported below, after the login checks
  }

  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please verify your mobile number first.");
  if (user.role === "ADMIN") throw new HttpError(400, "Admin accounts cannot apply as drivers.");

  const existing = await db.driver.findUnique({ where: { userId: user.id } });
  if (existing?.status === "APPROVED") throw new HttpError(400, "You are already an approved driver. Please log in.");
  if (existing?.status === "PENDING") throw new HttpError(400, "Your application is already under review.");

  if (!upload) throw new HttpError(400, "Please send the application as a form with photos.");
  const form = upload;
  const text = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : undefined);
  const data = fields.parse({
    name: text("name"),
    licenceNo: text("licenceNo"),
    licenceExpiry: text("licenceExpiry"),
    address: text("address"),
    experienceYears: text("experienceYears") ?? "0",
    emergencyContact: text("emergencyContact") ?? "",
    aadhaarLast4: text("aadhaarLast4") ?? "",
  });
  const licenceExpiry = new Date(`${data.licenceExpiry}T00:00:00+05:30`);
  if (licenceExpiry < new Date()) throw new HttpError(400, "Your driving licence has expired.");

  const file = (k: string) => {
    const f = form.get(k);
    return f && typeof f !== "string" && f.size > 0 ? (f as File) : null;
  };
  const photo = file("photo");
  const licence = file("licencePhoto");
  const aadhaar = file("aadhaarPhoto");
  if (!photo && !existing?.photoUrl) throw new HttpError(400, "Please add your photo.");
  if (!licence && !existing?.licencePhoto) throw new HttpError(400, "Please add a photo of your driving licence.");

  const photoUrl = photo ? publicFileUrl(await saveImage(photo, "public", "Your photo")) : existing!.photoUrl;
  const licencePhoto = licence ? await saveImage(licence, "private", "Licence photo") : existing!.licencePhoto;
  const aadhaarPhoto = aadhaar ? await saveImage(aadhaar, "private", "Aadhaar photo") : existing?.aadhaarPhoto ?? null;

  const values = {
    status: "PENDING",
    licenceNo: data.licenceNo,
    licenceExpiry,
    address: data.address,
    experienceYears: data.experienceYears,
    emergencyContact: data.emergencyContact,
    aadhaarLast4: data.aadhaarLast4 || null,
    photoUrl,
    licencePhoto,
    aadhaarPhoto,
    active: false,
    appliedAt: new Date(),
    reviewedAt: null,
    rejectReason: null,
  };
  await db.user.update({ where: { id: user.id }, data: { name: data.name } });
  if (existing) await db.driver.update({ where: { id: existing.id }, data: values });
  else await db.driver.create({ data: { ...values, userId: user.id } });

  return ok({ status: "PENDING" }, 201);
});
