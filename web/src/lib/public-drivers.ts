import { db } from "./db";

/**
 * Drivers shown to the public ("Our drivers" on the website and in the customer app): approved, active and
 * not hidden by the office. Only the name, photo, experience and trips done — never the phone or documents.
 */
export async function publicDrivers() {
  const list = await db.driver.findMany({
    where: { status: "APPROVED", active: true, showOnWebsite: true },
    include: { user: { select: { name: true } }, _count: { select: { trips: { where: { status: "COMPLETED" } }, bookings: { where: { status: "COMPLETED", kind: "RENTAL" } } } } },
    orderBy: { createdAt: "asc" },
  });
  return list.map((d) => ({
    id: d.id,
    name: d.user.name,
    photoUrl: d.photoUrl,
    experienceYears: d.experienceYears,
    tripsDone: d._count.trips + d._count.bookings,
  }));
}
