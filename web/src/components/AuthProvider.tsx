import { ReactNode } from "react";
import { AuthContext, useAuthProvider } from "@/hooks/useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  return <AuthContext value={auth}>{children}</AuthContext>;
}
