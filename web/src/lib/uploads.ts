import crypto from "node:crypto";
import { db } from "./db";
import { HttpError } from "./http";

/**
 * Uploaded images are stored in the database (StoredFile), so nothing depends on a local disk.
 * public:  driver profile photos (shown to passengers)   → /api/files/public/<name>
 * private: licence / Aadhaar images (admin and owner only) → /api/files/private/<name>
 */
export type Visibility = "public" | "private";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 4 * 1024 * 1024; // Vercel limits a request body to ~4.5 MB

export async function saveImage(file: File, visibility: Visibility, label: string) {
  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(400, `${label}: please upload a JPG, PNG or WebP photo.`);
  if (file.size > MAX_BYTES) throw new HttpError(400, `${label}: photo is too large (max 4 MB).`);
  const name = `${crypto.randomUUID()}.${ext}`;
  await db.storedFile.create({ data: { name, visibility, contentType: file.type, data: Buffer.from(await file.arrayBuffer()) } });
  return name;
}

/** Loads a stored file if the name is well-formed and matches the visibility. */
export async function loadFile(visibility: Visibility, name: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name)) return null;
  const f = await db.storedFile.findUnique({ where: { name } });
  return f && f.visibility === visibility ? f : null;
}

export const publicFileUrl = (name: string) => `/api/files/public/${name}`;
export const privateFileUrl = (name: string) => `/api/files/private/${name}`;
