import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { CoachRoute } from "@/components/layout/CoachRoute";
import { AthleteRoute } from "@/components/layout/AthleteRoute";
import { AdminRoute } from "@/components/layout/AdminRoute";
import { CoachLayout } from "@/components/layout/CoachLayout";
import { AthleteLayout } from "@/components/layout/AthleteLayout";
import { AthleteDetailLayout } from "@/components/layout/AthleteDetailLayout";
import { LoginPage } from "@/pages/LoginPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { AcceptInvitePage } from "@/pages/AcceptInvitePage";
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
import { MyDashboardPage } from "@/pages/MyDashboardPage";
import { AdminCoachesPage } from "@/pages/AdminCoachesPage";
import { AdminAssignmentsPage } from "@/pages/AdminAssignmentsPage";
import { AthleteBilanPage } from "@/pages/AthleteBilanPage";
import { MyBilanPage } from "@/pages/MyBilanPage";
import { MyTrendsPage } from "@/pages/MyTrendsPage";
import { MyProfilePage } from "@/pages/MyProfilePage";
import { SessionComparisonPage } from "@/pages/SessionComparisonPage";
import { useTheme } from "@/hooks/useTheme";
import { Toaster } from "sonner";

function AppRoutes() {
  const { theme } = useTheme();

  return (
    <>
      <Toaster position="bottom-right" theme={theme} richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        <Route element={<ProtectedRoute />}>
          {/* Coach routes */}
          <Route element={<CoachRoute />}>
            <Route element={<CoachLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/activities" element={<ActivitiesPage />} />
              <Route path="/activities/:id" element={<ActivityDetailPage />} />
              <Route path="/activities/:id/compare" element={<SessionComparisonPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/athletes" element={<AthletesPage />} />
              <Route path="/profiles" element={<ProfilesPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin/coaches" element={<AdminCoachesPage />} />
                <Route path="/admin/assignments" element={<AdminAssignmentsPage />} />
              </Route>
              <Route path="/athletes/:id" element={<AthleteDetailLayout />}>
                <Route index element={<Navigate to="bilan" />} />
                <Route path="bilan" element={<AthleteBilanPage />} />
                <Route path="profile" element={<AthleteProfilePage />} />
                <Route path="trends" element={<AthleteTrendsPage />} />
              </Route>
            </Route>
          </Route>

          {/* Athlete routes */}
          <Route element={<AthleteRoute />}>
            <Route element={<AthleteLayout />}>
              <Route path="/mon-espace" element={<MyDashboardPage />} />
              <Route path="/mon-espace/bilan" element={<MyBilanPage />} />
              <Route path="/mon-espace/seances" element={<AthleteHomePage />} />
              <Route path="/mon-espace/calendrier" element={<CalendarPage />} />
              <Route path="/mon-espace/tendances" element={<MyTrendsPage />} />
              <Route path="/mon-espace/profil" element={<MyProfilePage />} />
              <Route path="/mon-espace/activities/:id" element={<ActivityDetailPage />} />
              <Route path="/mon-espace/activities/:id/compare" element={<SessionComparisonPage />} />
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
