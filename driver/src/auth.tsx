import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, Application, setAccessLostHandler, setAuthToken, TOKEN_KEY, User } from './api';
import { stopLocationSharing } from './location';

export const ADMIN_NOT_ALLOWED = 'Admin accounts cannot use the driver app. Please use the website admin panel.';

/**
 * Where a logged-in user belongs:
 * - driver:   approved DRIVER account → Duties tabs
 * - apply:    no application yet → Apply form
 * - pending:  application under review (or approved while the role switch is still pending)
 * - rejected: application not approved → reason + "Fix and re-apply"
 * - unknown:  the status couldn't be loaded (offline) → status screen with retry
 */
export type Access = 'driver' | 'apply' | 'pending' | 'rejected' | 'unknown';

type Session = { user: User; application: Application | null; access: Access };

type AuthState = {
  ready: boolean;
  user: User | null;
  application: Application | null;
  access: Access | null;
  /**
   * Sends an OTP to the mobile number, or to `email` when given (new accounts only).
   * Returns the dev-mode OTP when the server is in test mode.
   */
  requestOtp: (phone: string, email?: string) => Promise<{ devOtp?: string; isNewUser?: boolean }>;
  /** Verifies the OTP. Resolves `{ needsName: true }` for a new number: ask for the name and call again with it. */
  verifyOtp: (phone: string, otp: string, name?: string, email?: string) => Promise<{ needsName: boolean }>;
  loginPassword: (login: string, password: string) => Promise<void>;
  /** Creates an account with a password (used while the server has no SMS/email OTP set up) and logs in. */
  registerPassword: (input: { name: string; phone: string; password: string }) => Promise<void>;
  /** Reloads the account and driver application, which re-runs the status routing. */
  refreshAccess: () => Promise<Access | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function accessFor(user: User, app: Application | null): Access {
  if (!app) return 'apply';
  if (app.status === 'REJECTED') return 'rejected';
  if (app.status === 'APPROVED' && user.role === 'DRIVER') return 'driver';
  return 'pending';
}

/** Loads the driver application for `user` (the token must already be set). */
async function loadSession(user: User): Promise<Session> {
  try {
    const { application } = await api<{ application: Application | null }>('/api/driver/application');
    return { user, application, access: accessFor(user, application) };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    // Status unknown (offline / server error): an existing driver still gets the Duties screen,
    // which shows its own error and retries; anyone else sees the status screen with a retry button.
    return { user, application: null, access: user.role === 'DRIVER' ? 'driver' : 'unknown' };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const refreshing = useRef<Promise<Access | null> | null>(null);

  const clear = useCallback(async () => {
    setAuthToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setSession(null);
  }, []);

  /** Any account can log in (new drivers start as CUSTOMER and apply); admin accounts are logged straight back out. */
  const accept = useCallback(
    async (r: { token: string; user: User }) => {
      if (r.user.role === 'ADMIN') {
        await api('/api/auth/logout', { method: 'POST', token: r.token }).catch(() => {});
        await clear();
        throw new Error(ADMIN_NOT_ALLOWED);
      }
      setAuthToken(r.token);
      try {
        const s = await loadSession(r.user);
        await SecureStore.setItemAsync(TOKEN_KEY, r.token);
        // One state update decides the route, so no screen flashes in between.
        setSession(s);
      } catch (e) {
        setAuthToken(null);
        throw e;
      }
    },
    [clear],
  );

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const { user } = await api<{ user: User }>('/api/auth/me');
          if (user.role === 'ADMIN') await clear();
          else setSession(await loadSession(user));
        }
      } catch (e) {
        // Expired or invalid token: forget it. Network errors keep the token for next launch.
        if (e instanceof ApiError && e.status === 401) await clear();
      } finally {
        setReady(true);
      }
    })();
  }, [clear]);

  const refreshAccess = useCallback(() => {
    refreshing.current ??= (async () => {
      try {
        const { user } = await api<{ user: User }>('/api/auth/me');
        const s = await loadSession(user);
        setSession(s);
        return s.access;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await clear();
          return null;
        }
        throw e;
      } finally {
        refreshing.current = null;
      }
    })();
    return refreshing.current;
  }, [clear]);

  // A duty call answered 403 "under review" / "not approved": re-run the routing.
  useEffect(() => {
    setAccessLostHandler(() => {
      refreshAccess().catch(() => {});
    });
    return () => setAccessLostHandler(null);
  }, [refreshAccess]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user: session?.user ?? null,
      application: session?.application ?? null,
      access: session?.access ?? null,
      requestOtp: (phone, email) =>
        api<{ sent: boolean; isNewUser?: boolean; devOtp?: string }>('/api/auth/otp/request', { body: email ? { phone, email, channel: 'EMAIL' } : { phone } }),
      verifyOtp: async (phone, otp, name, email) => {
        const body: Record<string, string> = { phone, otp };
        if (name?.trim()) body.name = name.trim();
        if (email) Object.assign(body, { email, channel: 'EMAIL' });
        const r = await api<{ token?: string; user?: User; needsName?: boolean }>('/api/auth/otp/verify', { body });
        if (r.needsName || !r.token || !r.user) return { needsName: true };
        await accept({ token: r.token, user: r.user });
        return { needsName: false };
      },
      loginPassword: async (login, password) => {
        await accept(await api<{ token: string; user: User }>('/api/auth/login', { body: { login: login.trim(), password } }));
      },
      registerPassword: async (input) => {
        await accept(await api<{ token: string; user: User }>('/api/auth/register', { body: input }));
      },
      refreshAccess,
      logout: async () => {
        await stopLocationSharing();
        await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
        await clear();
      },
    }),
    [ready, session, accept, clear, refreshAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
