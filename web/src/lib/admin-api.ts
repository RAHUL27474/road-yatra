import { AsyncLocalStorage } from "node:async_hooks";
import { getRequestUser, type SessionUser } from "./auth";
import { HttpError } from "./http";

/**
 * Lets the office server actions (app/admin/actions.ts) also run behind /api/admin/actions/* for the mobile app.
 * Inside this context the actions take the user from the Bearer token, and report errors and "done" as values
 * instead of redirecting the browser.
 */
const store = new AsyncLocalStorage<{ user: SessionUser }>();

export const adminApiUser = () => store.getStore()?.user ?? null;
export const runAsAdminApi = <T>(user: SessionUser, fn: () => Promise<T>) => store.run({ user }, fn);

/** Thrown by an action that finished and would have redirected the browser to `path`. */
export class ApiDone {
  constructor(public path: string) {}
}

/** For /api/admin/* routes: the logged-in admin, or 401 / 403. */
export async function requireAdminRequest(req: Request) {
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  if (user.role !== "ADMIN") throw new HttpError(403, "Only the office can do this.");
  return user;
}

/** JSON body → the FormData an admin form would post (true → "on", arrays → repeated fields, empty values left out). */
export function toFormData(body: Record<string, unknown>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(body ?? {})) {
    for (const item of Array.isArray(v) ? v : [v]) {
      if (item === undefined || item === null || item === false) continue;
      f.append(k, item === true ? "on" : String(item));
    }
  }
  return f;
}

/** Serialises Prisma rows for JSON: dates become ISO strings (NextResponse.json does that already; kept for clarity). */
export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
