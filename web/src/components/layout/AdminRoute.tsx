import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/auth/roles";

export function AdminRoute() {
  const { role } = useAuth();

  if (!isAdmin(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
