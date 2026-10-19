import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
  signup as apiSignup,
  updateDisplayName
} from "./api";
import { readSession } from "./storage";
import type { SessionUser } from "./types";

/**
 * Learner session, shared by the whole app.
 *
 * Anonymous practice keeps working without an account — signing in only
 * attaches a real name to contest entries and leaderboard rows. The session
 * lives in localStorage; the bearer is validated lazily on mount and trusted
 * while the API is unreachable, so no one gets signed out by a flaky network.
 */

interface AuthValue {
  user: SessionUser | null;
  signIn(username: string, password: string): Promise<SessionUser>;
  signUp(username: string, password: string, displayName: string): Promise<SessionUser>;
  signOut(): void;
  updateName(displayName: string): Promise<SessionUser>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => readSession()?.user ?? null);

  // Validate the stored bearer once on load (also picks up profile renames).
  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((fresh) => {
      if (!cancelled) setUser(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const next = await apiLogin({ username, password });
    setUser(next);
    return next;
  }, []);

  const signUp = useCallback(async (username: string, password: string, displayName: string) => {
    const next = await apiSignup({ username, password, displayName });
    setUser(next);
    return next;
  }, []);

  const signOut = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const updateName = useCallback(async (displayName: string) => {
    const next = await updateDisplayName(displayName);
    setUser(next);
    return next;
  }, []);

  const value = useMemo(
    () => ({ user, signIn, signUp, signOut, updateName }),
    [user, signIn, signUp, signOut, updateName]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
