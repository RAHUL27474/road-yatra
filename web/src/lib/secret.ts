/** Secret used to sign login tokens and hash OTPs. Must be a long random string in production. */
export function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s.length < 32 || s.startsWith("change-me"))) {
    throw new Error("JWT_SECRET is missing or too weak. Set a random string of at least 32 characters in the server environment.");
  }
  return s || "dev-secret";
}
