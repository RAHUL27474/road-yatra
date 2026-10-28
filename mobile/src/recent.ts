// Recent seat searches on this phone (newest first), shown as one-tap chips on Home.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecentSearch = { from: string; to: string; date: string };

const KEY = 'ry_recent_searches';
const MAX = 5;

export async function loadRecentSearches(): Promise<RecentSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentSearch[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && r.from && r.to && r.date) : [];
  } catch {
    return [];
  }
}

/** Puts this route first (one entry per route) and keeps the last few. */
export async function saveRecentSearch(s: RecentSearch): Promise<RecentSearch[]> {
  const list = [s, ...(await loadRecentSearches()).filter((r) => r.from !== s.from || r.to !== s.to)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
  return list;
}

export async function clearRecentSearches() {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
