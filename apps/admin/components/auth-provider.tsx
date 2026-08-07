"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getMe, login as loginRequest, logout as logoutRequest } from "@/lib/api";
import type { AdminUser } from "@/lib/types";

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: AdminUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const publicPaths = new Set(["/login", "/verify-email", "/reset-password"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    const current = await getMe();
    setUser(current);
  }, []);

  useEffect(() => {
    let active = true;
    void refreshUser()
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshUser]);

  useEffect(() => {
    if (loading) return;
    if (!user && !publicPaths.has(pathname)) router.replace("/login");
    if (user && pathname === "/login") router.replace("/dashboard");
  }, [loading, pathname, router, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setUser,
      refreshUser,
      login: async (email, password) => {
        const result = await loginRequest(email, password);
        setUser(result.user);
        router.replace("/dashboard");
      },
      logout: async () => {
        await logoutRequest();
        setUser(null);
        router.replace("/login");
      },
    }),
    [loading, refreshUser, router, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}