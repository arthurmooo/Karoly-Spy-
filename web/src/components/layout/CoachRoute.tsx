import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isCoach } from "@/lib/auth/roles";

export function CoachRoute() {
  const { role } = useAuth();

  if (!isCoach(role)) {
    return <Navigate to="/mon-espace" replace />;
  }

  return <Outlet />;
}
