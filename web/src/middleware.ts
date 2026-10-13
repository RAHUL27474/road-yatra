import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS for the JSON API, so the Expo apps can also be previewed in a browser (Expo web) on another port.
 * The API authenticates with Bearer tokens; cookies are not sent cross-origin, so allowing any origin is safe here.
 */
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

export function middleware(req: NextRequest) {
  if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: HEADERS });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
