import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isAthlete } from "@/lib/auth/roles";

export function AthleteRoute() {
  const { role } = useAuth();

  if (!isAthlete(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
