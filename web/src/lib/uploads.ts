import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./http";

/**
 * Uploaded images are stored on disk under web/uploads/{public,private}.
 * public:  driver profile photos (shown to passengers)   → /api/files/public/<name>
 * private: licence / Aadhaar images (admin and owner only) → /api/files/private/<name>
 * In production, point UPLOAD_DIR at persistent storage (or swap this file for S3 / R2).
 */
export const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
export type Visibility = "public" | "private";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 6 * 1024 * 1024;

export async function saveImage(file: File, visibility: Visibility, label: string) {
  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(400, `${label}: please upload a JPG, PNG or WebP photo.`);
  if (file.size > MAX_BYTES) throw new HttpError(400, `${label}: photo is too large (max 6 MB).`);
  const name = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(UPLOAD_ROOT, visibility);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

/** Resolves a stored file name safely (no path traversal). */
export function filePath(visibility: Visibility, name: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name)) return null;
  return path.join(UPLOAD_ROOT, visibility, name);
}

export const publicFileUrl = (name: string) => `/api/files/public/${name}`;
export const privateFileUrl = (name: string) => `/api/files/private/${name}`;

export const contentType = (name: string) => ({ jpg: "image/jpeg", png: "image/png", webp: "image/webp" })[name.split(".").pop() as string] ?? "application/octet-stream";
