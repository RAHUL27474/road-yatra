"use client";

import { usePathname } from "next/navigation";

/** Renders the public site's header/footer everywhere except the office portal, which has its own layout. */
export default function PublicChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === "/admin" || path.startsWith("/admin/") ? null : children;
}
