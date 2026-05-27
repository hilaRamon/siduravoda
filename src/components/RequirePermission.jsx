import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ShieldOff } from 'lucide-react';

export default function RequirePermission({ check, children, fallback }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!check(user)) {
    if (fallback) return fallback;
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 text-center text-muted-foreground">
        <ShieldOff size={48} className="opacity-30" />
        <p className="font-medium">אין הרשאת גישה לעמוד זה.</p>
      </div>
    );
  }

  return children;
}

/** Redirect time-only reporters away from the main app shell */
export function RequireMainApp({ children }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const isReporterOnly =
    user?.role === 'user' &&
    user?.can_report_time &&
    !user?.can_view_time_reports;

  if (isReporterOnly) {
    return <Navigate to="/time-reporting" replace />;
  }

  return children;
}
