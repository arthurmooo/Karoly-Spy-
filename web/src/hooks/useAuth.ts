import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AppRole } from "@/lib/auth/roles";
import { getRole } from "@/lib/auth/roles";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuthProvider(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [rawRole, setRawRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("Auth bootstrap timeout")), 4000);
          }),
        ]);

        if (cancelled) return;

        const currentSession = result.data.session;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (currentSession?.user) {
          void fetchRole(currentSession.user.id, cancelled);
        } else {
          setRawRole(null);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Auth bootstrap failed:", error);
        setSession(null);
        setUser(null);
        setRawRole(null);
        setLoading(false);
      }
    }

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user) {
        void fetchRole(s.user.id, cancelled);
      } else {
        setRawRole(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchRole(userId: string, cancelled = false) {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (cancelled) return;
      if (error) {
        console.error("Role fetch failed:", error);
        setRawRole("coach");
        return;
      }

      setRawRole(data?.role ?? "coach");
    } catch (error) {
      if (cancelled) return;
      console.error("Role fetch threw:", error);
      setRawRole("coach");
    }
  }

  const signIn = async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return { data: result.data, error: result.error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return { session, user, role: getRole(rawRole), loading, signIn, signOut };
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
