import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { loadFile } from "@/lib/uploads";

// GET /api/files/public/<name>  — anyone (driver photos)
// GET /api/files/private/<name> — admin, or the driver the document belongs to
export async function GET(req: Request, { params }: { params: Promise<{ visibility: string; name: string }> }) {
  const { visibility, name } = await params;
  if (visibility !== "public" && visibility !== "private") return new Response("Not found", { status: 404 });

  if (visibility === "private") {
    const user = await getRequestUser(req);
    if (!user) return new Response("Not authorised", { status: 403 });
    if (user.role !== "ADMIN") {
      const owner = await db.driver.findFirst({ where: { userId: user.id, OR: [{ licencePhoto: name }, { aadhaarPhoto: name }] }, select: { id: true } });
      if (!owner) return new Response("Not authorised", { status: 403 });
    }
  }
  const file = await loadFile(visibility, name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": visibility === "public" ? "public, max-age=86400, immutable" : "private, no-store",
    },
  });
}
