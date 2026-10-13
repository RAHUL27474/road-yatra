// Web preview build only: localStorage stands in for expo-secure-store (which has no web support).
// Every call is guarded because storage can be blocked (private mode, disabled site data).

export async function getItem(key: string): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {}
}

export async function deleteItem(key: string): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {}
}
