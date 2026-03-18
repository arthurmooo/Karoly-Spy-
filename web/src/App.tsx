import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { CoachRoute } from "@/components/layout/CoachRoute";
import { AthleteRoute } from "@/components/layout/AthleteRoute";
import { CoachLayout } from "@/components/layout/CoachLayout";
import { AthleteLayout } from "@/components/layout/AthleteLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ActivitiesPage } from "@/pages/ActivitiesPage";
import { ActivityDetailPage } from "@/pages/ActivityDetailPage";
import { ProfilesPage } from "@/pages/ProfilesPage";
import { AthletesPage } from "@/pages/AthletesPage";
import { HealthPage } from "@/pages/HealthPage";
import { AthleteTrendsPage } from "@/pages/AthleteTrendsPage";
import { AthleteProfilePage } from "@/pages/AthleteProfilePage";
import { CalendarPage } from "@/pages/CalendarPage";
import { AthleteHomePage } from "@/pages/AthleteHomePage";
import { useTheme } from "@/hooks/useTheme";
import { Toaster } from "sonner";

function AppRoutes() {
  const { theme } = useTheme();

  return (
    <>
      <Toaster position="bottom-right" theme={theme} richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          {/* Coach routes */}
          <Route element={<CoachRoute />}>
            <Route element={<CoachLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/activities" element={<ActivitiesPage />} />
              <Route path="/activities/:id" element={<ActivityDetailPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/athletes" element={<AthletesPage />} />
              <Route path="/profiles" element={<ProfilesPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/athletes/:id/profile" element={<AthleteProfilePage />} />
              <Route path="/athletes/:id/trends" element={<AthleteTrendsPage />} />
            </Route>
          </Route>

          {/* Athlete routes */}
          <Route element={<AthleteRoute />}>
            <Route element={<AthleteLayout />}>
              <Route path="/mon-espace" element={<AthleteHomePage />} />
              <Route path="/mon-espace/seances" element={<AthleteHomePage />} />
              <Route path="/mon-espace/activities/:id" element={<ActivityDetailPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
