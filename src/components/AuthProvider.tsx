"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, type User } from "@/lib/client";

function deviceFingerprint() {
  if (typeof window === "undefined") return undefined;
  const key = "toyswap_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = `fp_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(key, fp);
  }
  return fp;
}

type AuthCtx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: User | null }>("/api/auth");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username: string) => {
    const data = await api<{ user: User }>("/api/auth", {
      method: "POST",
      body: JSON.stringify({
        username,
        deviceFingerprint: deviceFingerprint(),
      }),
    });
    setUser(data.user);
  };

  const logout = async () => {
    await api("/api/auth", { method: "DELETE" });
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, refresh, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
