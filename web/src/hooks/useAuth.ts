import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AppRole } from "@/lib/auth/roles";
import { getRole } from "@/lib/auth/roles";
import { resolveAuthTransition } from "@/lib/auth/sessionTransition";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole;
  loading: boolean;
  isRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
  clearRecovery: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuthProvider(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [rawRole, setRawRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);
  const bootstrapDoneRef = useRef(false);

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
        const nextUserId = currentSession?.user?.id ?? null;
        const decision = resolveAuthTransition({
          event: "BOOTSTRAP",
          previousUserId: lastUserIdRef.current,
          nextUserId,
        });

        lastUserIdRef.current = decision.nextKnownUserId;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (decision.shouldClearRole) {
          setRawRole(null);
        }

        if (decision.shouldFetchRole && nextUserId) {
          await fetchRole(nextUserId, cancelled);
          if (!cancelled) {
            bootstrapDoneRef.current = true;
            setLoading(false);
          }
        } else {
          bootstrapDoneRef.current = true;
          setLoading(false);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Auth bootstrap failed:", error);
        setSession(null);
        setUser(null);
        setRawRole(null);
        lastUserIdRef.current = null;
        bootstrapDoneRef.current = true;
        setLoading(false);
      }
    }

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (cancelled) return;

      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }

      const nextUserId = s?.user?.id ?? null;
      const decision = resolveAuthTransition({
        event,
        previousUserId: lastUserIdRef.current,
        nextUserId,
      });

      lastUserIdRef.current = decision.nextKnownUserId;
      setSession(s);
      setUser(s?.user ?? null);

      if (decision.shouldClearRole) {
        setRawRole(null);
      }

      if (!decision.shouldFetchRole || !nextUserId) {
        if (!decision.shouldBlockUi && bootstrapDoneRef.current) {
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      window.setTimeout(() => {
        if (cancelled || lastUserIdRef.current !== nextUserId) return;

        void fetchRole(nextUserId, cancelled).finally(() => {
          if (!cancelled && lastUserIdRef.current === nextUserId) {
            setLoading(false);
          }
        });
      }, 0);
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

      if (cancelled || lastUserIdRef.current !== userId) return;
      if (error) {
        console.error("Role fetch failed:", error);
        setRawRole("coach");
        return;
      }

      setRawRole(data?.role ?? "coach");
    } catch (error) {
      if (cancelled || lastUserIdRef.current !== userId) return;
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

  const clearRecovery = () => setIsRecovery(false);

  return { session, user, role: getRole(rawRole), loading, isRecovery, signIn, signOut, clearRecovery };
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
