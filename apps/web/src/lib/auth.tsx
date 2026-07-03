import type { Role, User } from "@gov-dashboard/shared-types";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAccessToken, setUnauthorizedHandler } from "./apiClient";

interface LoginResponse {
  accessToken: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous";
  loginAsPersona: (role: Role) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccessToken(null);
      setUser(null);
      setStatus("anonymous");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    api
      .post<LoginResponse>("/api/auth/refresh")
      .then(({ accessToken, user }) => {
        setAccessToken(accessToken);
        setUser(user);
        setStatus("authenticated");
      })
      .catch(() => setStatus("anonymous"));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      loginAsPersona: async (role) => {
        const { accessToken, user: nextUser } = await api.post<LoginResponse>("/api/auth/login/mock", { role });
        setAccessToken(accessToken);
        setUser(nextUser);
        setStatus("authenticated");
      },
      logout: async () => {
        await api.post("/api/auth/logout");
        setAccessToken(null);
        setUser(null);
        setStatus("anonymous");
      },
    }),
    [user, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
