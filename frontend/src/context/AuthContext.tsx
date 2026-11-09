import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearStoredToken, getStoredToken, storeToken } from "../lib/api";
import type { User } from "../lib/types";

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
  must_change_password?: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  mustChangePassword: boolean;
  login: (identifier: string, password: string, remember: boolean) => Promise<User>;
  submitFirstPassword: (newPassword: string, confirmPassword: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    let active = true;
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me")
      .then((profile) => {
        if (active) {
          setUser(profile);
          if (profile.must_change_password) {
            setMustChangePassword(true);
          }
        }
      })
      .catch(() => {
        clearStoredToken();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setMustChangePassword(false);
    };
    window.addEventListener("stackzyro:unauthorized", onUnauthorized);
    return () => window.removeEventListener("stackzyro:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (identifier: string, password: string, remember: boolean) => {
    const response = await api.post<LoginResponse>("/auth/login", {
      username_or_email: identifier.trim(),
      email: identifier.trim(),
      password,
      remember,
    });
    storeToken(response.access_token, remember);
    setUser(response.user);
    if (response.must_change_password) {
      setMustChangePassword(true);
    }
    return response.user;
  }, []);

  const submitFirstPassword = useCallback(async (newPassword: string, confirmPassword: string) => {
    const res = await api.post<LoginResponse>("/auth/first-login-password", {
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    if (res.access_token) {
      storeToken(res.access_token, false);
    }
    if (res.user) {
      setUser(res.user);
    }
    setMustChangePassword(false);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setMustChangePassword(false);
  }, []);

  const value = useMemo(
    () => ({ user, loading, mustChangePassword, login, submitFirstPassword, logout, setUser }),
    [user, loading, mustChangePassword, login, submitFirstPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
