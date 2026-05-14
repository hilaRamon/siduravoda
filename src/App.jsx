import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, MemoryRouter } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
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


const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Assignments />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/workplaces" element={<Workplaces />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/absence-requests" element={<AbsenceRequests />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/time-reports" element={<TimeReportsAdmin />} />
        <Route path="/admin-tools" element={<AdminTools />} />
      </Route>
      <Route path="/schedule" element={<PublicSchedule />} />
      <Route path="/time-reporting" element={<TimeReporting />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

// Isolated app for time-reporting — no sidebar, no other routes accessible
function TimeReportingApp() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <MemoryRouter initialEntries={['/time-reporting']}>
        <Routes>
          <Route path="/time-reporting" element={<TimeReporting />} />
          <Route path="*" element={<TimeReporting />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

function App() {
  // If the URL path is /time-reporting, render the isolated app
  if (window.location.pathname === '/time-reporting') {
    return <TimeReportingApp />;
  }

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;