import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User, mockUsers } from './mock-data';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'kingg_token';
const USER_KEY = 'kingg_user';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const exp = Number(payload?.exp);
    if (!Number.isFinite(exp)) return null;
    return exp * 1000;
  } catch {
    return null;
  }
}

function persistSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function restoreSessionUser(): User | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return null;

  const expMs = parseJwtExpMs(token);
  if (expMs && Date.now() >= expMs) {
    clearSession();
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser) as User;
    if (!parsed?.id || !parsed?.email || !parsed?.role) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    clearSession();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    return restoreSessionUser();
  });

  useEffect(() => {
    if (!user) return;
    // Keep local copy fresh when user changes (same token key retained).
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }, [user]);

  const login = async (email: string, password: string) => {
    const normalizedEmail = email.trim();
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        token?: string;
        user?: { id: string; name: string; email: string; role: User['role'] };
      };
      if (!data?.token || !data?.user) return null;
      const nextUser: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
      };
      persistSession(data.token, nextUser);
      setUser(nextUser);
      return nextUser;
    } catch {
      // Dev fallback if API is unavailable.
      const found = mockUsers.find((u) => u.email === normalizedEmail);
      if (!found) return null;
      setUser(found);
      return found;
    }
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

  const isAuthenticated = useMemo(() => !!user, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
