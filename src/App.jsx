import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, MemoryRouter } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import RequirePermission, { RequireMainApp } from '@/components/RequirePermission';
import { canAccessAdminTools, canViewTimeReports, canReportTime } from '@/lib/permissions';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Workplaces from './pages/Workplaces';
import Assignments from './pages/Assignments.jsx';
import Roles from './pages/Roles';
import Reports from './pages/Reports';
import Vehicles from './pages/Vehicles';
import PublicSchedule from './pages/PublicSchedule';
import AbsenceRequests from './pages/AbsenceRequests';
import Calendar from './pages/Calendar';
import TimeReporting from './pages/TimeReporting';
import TimeReportsAdmin from './pages/TimeReportsAdmin';
import AdminTools from './pages/AdminTools';


function MainAppShell() {
  return (
    <ProtectedRoute>
      <RequireMainApp>
        <Layout />
      </RequireMainApp>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/schedule" element={<PublicSchedule />} />

      <Route
        path="/time-reporting"
        element={
          <ProtectedRoute>
            <RequirePermission check={canReportTime}>
              <TimeReporting />
            </RequirePermission>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<MainAppShell />}>
        <Route index element={<Assignments />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="workplaces" element={<Workplaces />} />
        <Route path="roles" element={<Roles />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="reports" element={<Reports />} />
        <Route path="absence-requests" element={<AbsenceRequests />} />
        <Route path="calendar" element={<Calendar />} />
        <Route
          path="time-reports"
          element={
            <RequirePermission check={canViewTimeReports}>
              <TimeReportsAdmin />
            </RequirePermission>
          }
        />
        <Route
          path="admin-tools"
          element={
            <RequirePermission check={canAccessAdminTools}>
              <AdminTools />
            </RequirePermission>
          }
        />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function TimeReportingApp() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <MemoryRouter initialEntries={['/time-reporting']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/time-reporting"
              element={
                <ProtectedRoute>
                  <RequirePermission check={canReportTime}>
                    <TimeReporting />
                  </RequirePermission>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/time-reporting" replace />} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

function App() {
  if (window.location.pathname === '/time-reporting') {
    return <TimeReportingApp />;
  }

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
