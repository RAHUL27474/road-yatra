/** Small fetch wrapper for client components. Throws Error(message) on API errors. */
export async function apiFetch<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

/** Converts an absolute pay URL from the API into a same-site path. */
export function payPath(payUrl: string) {
  const u = new URL(payUrl);
  return u.pathname + u.search;
}
