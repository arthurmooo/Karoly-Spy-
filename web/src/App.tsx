import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { CoachLayout } from "@/components/layout/CoachLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ActivitiesPage } from "@/pages/ActivitiesPage";
import { ActivityDetailPage } from "@/pages/ActivityDetailPage";
import { ProfilesPage } from "@/pages/ProfilesPage";
import { HealthPage } from "@/pages/HealthPage";
import { AthleteTrendsPage } from "@/pages/AthleteTrendsPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { useTheme } from "@/hooks/useTheme";

export default function App() {
  useTheme(); // Initialize theme

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<CoachLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/activities/:id" element={<ActivityDetailPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/profiles" element={<ProfilesPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/athletes/:id/trends" element={<AthleteTrendsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
