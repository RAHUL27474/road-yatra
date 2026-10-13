import * as storage from './storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, setAuthToken, User } from './api';

const TOKEN_KEY = 'ry_token';

export type OtpRequestResult = { sent: boolean; isNewUser: boolean; devOtp?: string };

type AuthState = {
  ready: boolean;
  user: User | null;
  login: (login: string, password: string) => Promise<void>;
  register: (input: { name: string; email?: string; phone: string; password: string }) => Promise<void>;
  /** Sends a 6-digit OTP. Throws ApiError(503) when OTP login is not set up on the server. */
  requestOtp: (phone: string) => Promise<OtpRequestResult>;
  /** Logs in with the OTP. Returns `needsName` for a new number sent without a name (resend with the name). */
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<{ needsName: boolean }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const save = useCallback(async (token: string | null, u: User | null) => {
    setAuthToken(token);
    if (token) await storage.setItem(TOKEN_KEY, token);
    else await storage.deleteItem(TOKEN_KEY);
    setUser(u);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getItem(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const { user: u } = await api<{ user: User }>('/api/auth/me');
          setUser(u);
        }
      } catch (e) {
        // Expired or invalid token: forget it. Network errors keep the token for next launch.
        if (e instanceof ApiError && e.status === 401) await save(null, null);
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
