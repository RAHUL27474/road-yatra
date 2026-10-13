import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";

export const GET = handle(async (req: Request) => {
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Not logged in.");
  return ok({ user });
});
