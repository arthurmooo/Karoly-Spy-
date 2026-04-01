import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute() {
  const { session, role, loading, isRecovery } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to reset password page during recovery flow
  if (isRecovery) {
    return <Navigate to="/reset-password" replace />;
  }

  // Auto-redirect root based on role
  if (location.pathname === "/") {
    return <Navigate to={role === "athlete" ? "/mon-espace" : "/dashboard"} replace />;
  }

  return <Outlet />;
}
