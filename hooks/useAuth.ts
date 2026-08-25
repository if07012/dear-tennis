'use client';

import { useCallback, useEffect, useState } from 'react';

const AUTH_STORAGE_KEY = 'authUser';
const AUTH_EVENT = 'dearTennis:authChange';

export type AuthUser = { id: string; email: string; name: string };

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
