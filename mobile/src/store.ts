import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_URL, type QuoteResponse, type RentalRequest } from './api';

// Tiny in-memory store for data passed between screens that is too big for route params, plus browser helpers.

/** The last rental quote, so the results / passenger screens don't need to re-quote. */
export const rentalCache: { req: RentalRequest | null; data: QuoteResponse | null } = { req: null, data: null };

export const sameRequest = (a: RentalRequest | null, b: RentalRequest) =>
  !!a &&
  a.rentalType === b.rentalType &&
  a.pickupCity === b.pickupCity &&
  (a.dropCity || '') === (b.dropCity || '') &&
  a.startAt === b.startAt &&
  (a.returnAt || '') === (b.returnAt || '');

/**
 * If the server has no APP_URL set it builds links (payment, tracking, invoice) on http://localhost:3000,
 * which a phone can't open. In that case point the link at the API host the app is already using.
 */
export function reachableUrl(url: string) {
  return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?=\/)/i, API_URL);
}

/** Opens the hosted payment page. Resolves when the browser is closed. */
export async function openPayment(rawUrl: string) {
  const payUrl = reachableUrl(rawUrl);
  try {
    await WebBrowser.openAuthSessionAsync(payUrl, Linking.createURL('/'));
  } catch {
    await WebBrowser.openBrowserAsync(payUrl);
  }
}

/** Opens a public page (live tracking, invoice) in the in-app browser. */
export async function openPage(rawUrl: string) {
  await WebBrowser.openBrowserAsync(reachableUrl(rawUrl));
}

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=in.roadyatra.app';

/** Opens this app's Play Store page (the Play Store app if installed, else the website). */
export async function openPlayStore() {
  try {
    await Linking.openURL('market://details?id=in.roadyatra.app');
  } catch {
    await Linking.openURL(PLAY_STORE_URL);
  }
}
