import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase";

interface AvatarMapState {
  getAvatarUrl: (name: string) => string | null;
  isLoading: boolean;
}

const AvatarMapContext = createContext<AvatarMapState>({
  getAvatarUrl: () => null,
  isLoading: true,
});

export function useAvatarMapProvider() {
  const [map, setMap] = useState<Map<string, string | null>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("athletes")
          .select("first_name, last_name, avatar_url")
          .eq("is_active", true);

        if (cancelled || error) return;

        const m = new Map<string, string | null>();
        for (const a of data ?? []) {
          const full = `${a.first_name} ${a.last_name}`;
          const short = `${a.first_name} ${a.last_name.charAt(0)}.`;
          m.set(full, a.avatar_url);
          m.set(full.toLowerCase(), a.avatar_url);
          m.set(short, a.avatar_url);
          m.set(short.toLowerCase(), a.avatar_url);
          // Single first name key for partial matches
          m.set(a.first_name, a.avatar_url);
          m.set(a.first_name.toLowerCase(), a.avatar_url);
        }
        setMap(m);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const getAvatarUrl = useCallback(
    (name: string): string | null => {
      return map.get(name) ?? map.get(name.toLowerCase()) ?? null;
    },
    [map],
  );

  return { getAvatarUrl, isLoading };
}

export { AvatarMapContext };

export function useAvatarMap() {
  return useContext(AvatarMapContext);
}
