import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from './types';
import { fetchCurrentUser, loginWithApi, signOutAuth, storeToken } from './auth-api';

type LoginOutcome = { user: User } | { error: string };

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  logout: () => void;
  refreshUser: (user: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((restored) => {
      if (!cancelled && restored) setUser(restored);
      if (!cancelled) setBootstrapping(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string): Promise<LoginOutcome> => {
    const result = await loginWithApi(email, password);
    if (!result.ok) return { error: result.error };
    storeToken(result.token);
    setUser(result.user);
    return { user: result.user };
  };

  const logout = () => {
    void signOutAuth();
    setUser(null);
  };

  const refreshUser = (next: User) => {
    setUser(next);
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
