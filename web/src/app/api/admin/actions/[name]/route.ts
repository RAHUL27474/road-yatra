import { Prisma } from "@prisma/client";
import * as actions from "@/app/admin/actions";
import { ApiDone, requireAdminRequest, runAsAdminApi, toFormData } from "@/lib/admin-api";
import { handle, HttpError, ok } from "@/lib/http";

/** The office actions the app may call: the same code the admin website's forms post to. */
const ACTIONS: Record<string, (f: FormData) => Promise<unknown>> = {
  saveVehicle: actions.saveVehicle,
  saveDriver: actions.saveDriver,
  removeDriver: actions.removeDriver,
  addRoute: actions.addRoute,
  deleteRoute: actions.deleteRoute,
  saveStop: actions.saveStop,
  scheduleTrips: actions.scheduleTrips,
  assignTripDriver: actions.assignTripDriver,
  cancelTrip: actions.cancelTrip,
  blockSeats: actions.blockSeats,
  unblockSeat: actions.unblockSeat,
  offlineSeatBooking: actions.offlineSeatBooking,
  offlineRentalBooking: actions.offlineRentalBooking,
  updateBooking: actions.updateBooking,
  saveSettings: actions.saveSettings,
  toggleRouteVehicle: actions.toggleRouteVehicle,
  markFeedbackHandled: actions.markFeedbackHandled,
  markCashReceived: actions.markCashReceived,
  resolveSos: actions.resolveSos,
  reviewDriverApplication: actions.reviewDriverApplication,
};

/** Useful bits of the page the website would have gone to next (e.g. ?created=3&skipped=1, ?q=RYAB12CD). */
function resultOf(path: string) {
  const q = new URL(path, "http://x").searchParams;
  const out: Record<string, string | number> = {};
  for (const k of ["created", "skipped", "removed", "reviewed", "saved"]) {
    const v = q.get(k);
    if (v != null) out[k] = /^\d+$/.test(v) ? Number(v) : v;
  }
  // Booking code of a new phone booking: ?created=CODE on a trip page, ?q=CODE on bookings.
  const code = q.get("q") ?? (typeof out.created === "string" ? out.created : null);
  if (code) out.code = code;
  return out;
}

export const POST = handle(async (req: Request, { params }: { params: Promise<{ name: string }> }) => {
  const user = await requireAdminRequest(req);
  const { name } = await params;
  const action = Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : null;
  if (!action) throw new HttpError(404, `Unknown action "${name}".`);
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Send a JSON object.");
  // Whole-form saves treat a missing field as "cleared", so an accidental empty body would wipe the settings.
  if (name === "saveSettings" && !String((body as Record<string, unknown>).legalName ?? "").trim()) {
    throw new HttpError(400, "Business name is required. Send the full settings form.");
  }

  try {
    await runAsAdminApi(user, () => action(toFormData(body as Record<string, unknown>)));
  } catch (e) {
    if (e instanceof ApiDone) return ok({ ok: true, redirect: e.path, ...resultOf(e.path) });
    // findUniqueOrThrow on an id that doesn't exist (deleted meanwhile, or a wrong id).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") throw new HttpError(404, "Not found. It may have been deleted. Refresh and try again.");
    throw e;
  }
  return ok({ ok: true });
});
