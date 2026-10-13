import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { privateFileUrl } from "@/lib/uploads";

// GET /api/driver/application -> the logged-in user's driver application/profile status
export const GET = handle(async (req: Request) => {
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  const d = await db.driver.findUnique({ where: { userId: user.id } });
  return ok({
    application: d
      ? {
          status: d.status, // PENDING | APPROVED | REJECTED
          active: d.active,
          name: user.name,
          phone: user.phone,
          licenceNo: d.licenceNo,
          licenceExpiry: d.licenceExpiry,
          address: d.address,
          experienceYears: d.experienceYears,
          emergencyContact: d.emergencyContact,
          aadhaarLast4: d.aadhaarLast4,
          photoUrl: d.photoUrl,
          licencePhotoUrl: d.licencePhoto ? privateFileUrl(d.licencePhoto) : null,
          aadhaarPhotoUrl: d.aadhaarPhoto ? privateFileUrl(d.aadhaarPhoto) : null,
          appliedAt: d.appliedAt,
          reviewedAt: d.reviewedAt,
          rejectReason: d.rejectReason,
        }
      : null,
  });
});
