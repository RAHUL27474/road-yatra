import * as storage from './storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, setAuthToken, User } from './api';
import { startBookingChecks, stopBookingChecks, TOKEN_KEY } from './background';
import { clearBookingCache } from './cache';
import { cancelAllReminders } from './notifications';

export type OtpRequestResult = { sent: boolean; isNewUser: boolean; devOtp?: string };
/** Sign-up details. `channel` is where the verification OTP goes: the mobile number or the email. */
export type RegisterInput = { name: string; email?: string; phone: string; password: string; channel: 'PHONE' | 'EMAIL' };

type AuthState = {
  ready: boolean;
  user: User | null;
  login: (login: string, password: string) => Promise<void>;
  /** Sign-up step 1: checks the details and sends the OTP. Returns where it went (and the OTP in test mode). */
  requestRegisterOtp: (input: RegisterInput) => Promise<{ sentTo: string; devOtp?: string }>;
  /** Sign-up step 2: verifies the OTP, creates the account and logs in. No OTP while the server has no SMS/email set up. */
  register: (input: RegisterInput & { otp?: string }) => Promise<void>;
  /** Sends a 6-digit OTP. Throws ApiError(503) when OTP login is not set up on the server. */
  requestOtp: (phone: string) => Promise<OtpRequestResult>;
  /** Logs in with the OTP. Returns `needsName` for a new number sent without a name (resend with the name). */
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<{ needsName: boolean }>;
  /** Edit name / email (the mobile number is the login and can't change). */
  updateProfile: (input: { name: string; email: string }) => Promise<void>;
  /** Deletes the account on the server (Google Play requirement) and logs out. */
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
};

const USER_KEY = 'ry_user';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const save = useCallback(async (token: string | null, u: User | null) => {
    setAuthToken(token);
    if (token) await storage.setItem(TOKEN_KEY, token);
    if (u) await storage.setItem(USER_KEY, JSON.stringify(u)).catch(() => {});
    if (!token) {
      await storage.deleteItem(TOKEN_KEY);
      await storage.deleteItem(USER_KEY).catch(() => {});
      // Logged out: no tickets, reminders or background checks of this account stay on the phone.
      await Promise.all([stopBookingChecks(), clearBookingCache(), cancelAllReminders()]);
    }
    setUser(u);
  }, []);

  // Watch the account's bookings in the background while logged in.
  useEffect(() => {
    if (user) startBookingChecks();
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getItem(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const { user: u } = await api<{ user: User }>('/api/auth/me');
          setUser(u);
          await storage.setItem(USER_KEY, JSON.stringify(u)).catch(() => {});
        }
      } catch (e) {
        // Expired or invalid token: forget it. Network errors keep the token for next launch.
        if (e instanceof ApiError && e.status === 401) await save(null, null);
        // Opened with no signal (e.g. at the pickup point): stay logged in as the last known account so the
        // tickets saved on the phone still open.
        else if (e instanceof ApiError && e.status === 0) {
          const cached = await storage.getItem(USER_KEY).then((v) => (v ? (JSON.parse(v) as User) : null)).catch(() => null);
          if (cached) setUser(cached);
        }
      } finally {
        setReady(true);
      }
    })();
  }, [save]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      login: async (login, password) => {
        const r = await api<{ token: string; user: User }>('/api/auth/login', { body: { login: login.trim(), password } });
        await save(r.token, r.user);
      },
      requestRegisterOtp: (input) => api<{ sentTo: string; devOtp?: string }>('/api/auth/register/otp', { body: input }),
      register: async (input) => {
        const r = await api<{ token: string; user: User }>('/api/auth/register', { body: input });
        await save(r.token, r.user);
      },
      requestOtp: (phone) => api<OtpRequestResult>('/api/auth/otp/request', { body: { phone } }),
      verifyOtp: async (phone, otp, name) => {
        const r = await api<{ token: string; user: User } | { needsName: true }>('/api/auth/otp/verify', {
          body: { phone, otp, ...(name ? { name } : {}) },
        });
        if ('needsName' in r) return { needsName: true };
        await save(r.token, r.user);
        return { needsName: false };
      },
      updateProfile: async (input) => {
        const r = await api<{ user: User }>('/api/auth/me', { method: 'PATCH', body: input });
        setUser(r.user);
        await storage.setItem(USER_KEY, JSON.stringify(r.user)).catch(() => {});
      },
      deleteAccount: async () => {
        await api('/api/auth/me', { method: 'DELETE' });
        await save(null, null);
      },
      logout: async () => {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
        await save(null, null);
      },
    }),
    [ready, user, save],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
