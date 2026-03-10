import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
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
          setRole(null);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Auth bootstrap failed:", error);
        setSession(null);
        setUser(null);
        setRole(null);
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
        setRole(null);
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
        setRole("coach");
        return;
      }

      setRole(data?.role ?? "coach");
    } catch (error) {
      if (cancelled) return;
      console.error("Role fetch threw:", error);
      setRole("coach");
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

  return { session, user, role, loading, signIn, signOut };
}
