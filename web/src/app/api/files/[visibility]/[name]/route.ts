import fs from "node:fs/promises";
import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { contentType, filePath } from "@/lib/uploads";

// GET /api/files/public/<name>  — anyone (driver photos)
// GET /api/files/private/<name> — admin, or the driver the document belongs to
export async function GET(req: Request, { params }: { params: Promise<{ visibility: string; name: string }> }) {
  const { visibility, name } = await params;
  if (visibility !== "public" && visibility !== "private") return new Response("Not found", { status: 404 });
  const p = filePath(visibility, name);
  if (!p) return new Response("Not found", { status: 404 });

  if (visibility === "private") {
    const user = await getRequestUser(req);
    if (!user) return new Response("Not authorised", { status: 403 });
    if (user.role !== "ADMIN") {
      const owner = await db.driver.findFirst({ where: { userId: user.id, OR: [{ licencePhoto: name }, { aadhaarPhoto: name }] }, select: { id: true } });
      if (!owner) return new Response("Not authorised", { status: 403 });
    }
  }
  try {
    const data = await fs.readFile(p);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType(name),
        "Cache-Control": visibility === "public" ? "public, max-age=86400" : "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
