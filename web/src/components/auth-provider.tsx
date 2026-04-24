"use client";

import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  PROFILE_ID_KEY,
  PROFILE_SESSION_EVENT,
  getProfileId,
  signOutProfile,
} from "@/lib/profile-client";
import { getFirebaseAuth } from "@/lib/firebase-client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const migrateAttempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      window.dispatchEvent(new Event(PROFILE_SESSION_EVENT));
    });
  }, []);

  useEffect(() => {
    if (!user) {
      migrateAttempted.current = new Set();
      return;
    }
    const legacy = getProfileId();
    if (!legacy || migrateAttempted.current.has(legacy)) return;
    migrateAttempted.current.add(legacy);
    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/profile/migrate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ legacyProfileId: legacy }),
        });
        if (res.ok) {
          localStorage.removeItem(PROFILE_ID_KEY);
          window.dispatchEvent(new Event(PROFILE_SESSION_EVENT));
        } else {
          migrateAttempted.current.delete(legacy);
        }
      } catch {
        migrateAttempted.current.delete(legacy);
      }
    })();
  }, [user]);

  const getIdToken = useCallback(async () => {
    const auth = getFirebaseAuth();
    const u = auth?.currentUser;
    if (!u) return null;
    try {
      return await u.getIdToken();
    } catch {
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    signOutProfile();
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch {
        /* ignore */
      }
    }
    window.dispatchEvent(new Event(PROFILE_SESSION_EVENT));
  }, []);

  const value = useMemo(
    () => ({ user, loading, getIdToken, signOut }),
    [user, loading, getIdToken, signOut]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

/** Safe when AuthProvider may not wrap (should not happen); for edge cases. */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
