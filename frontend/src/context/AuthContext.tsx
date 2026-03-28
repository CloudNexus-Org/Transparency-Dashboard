// AI assisted development
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type AuthUser } from '../lib/api';

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setSession: (token: string, user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_TOKEN = 'td_token';
const STORAGE_USER = 'td_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(STORAGE_USER);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_TOKEN),
  );
  const [loading, setLoading] = useState(false);

  const setSession = useCallback((t: string, u: AuthUser) => {
    localStorage.setItem(STORAGE_TOKEN, t);
    localStorage.setItem(STORAGE_USER, JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post<{ accessToken: string; user: AuthUser }>(
        '/auth/login',
        { email, password },
      );
      setSession(data.accessToken, data.user);
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      setSession,
    }),
    [user, token, loading, login, logout, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
