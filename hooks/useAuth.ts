'use client';

import { useCallback, useEffect, useState } from 'react';

const AUTH_STORAGE_KEY = 'authUser';
const AUTH_EVENT = 'dearTennis:authChange';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  /**
   * Optional base64 data URL for the user's profile photo. Set via
   * the profile photo editor; persisted on the users sheet by
   * PATCH /api/profile and mirrored into localStorage so other tabs /
   * components see the change without a full reload.
   */
  photo?: string;
  /**
   * Free-form rank label, e.g. "3.5 NTRP" or "Beginner". Set via the
   * profile editor; persisted on the users sheet's `rank` column.
   */
  rank?: string;
  /**
   * Optional phone number. Collected at registration and editable from
   * the profile editor; persisted on the users sheet's `phone` column.
   */
  phone?: string;
};

function readUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && typeof parsed.email === 'string') return parsed;
  } catch {
    // ignore — fall through to null
  }
  return null;
}

export function setAuthUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(readUser());
    setHydrated(true);
    const onChange = () => setUser(readUser());
    window.addEventListener(AUTH_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const logout = useCallback(() => setAuthUser(null), []);

  return { user, isAuthenticated: Boolean(user), hydrated, logout };
}
