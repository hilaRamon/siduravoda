import { Link, Outlet, useLocation } from 'react-router-dom';
import { Building2, CalendarDays, ShieldCheck, GraduationCap, BarChart2, Truck, MessageSquare, BookOpen, ClipboardCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const navItems = [
  { to: '/', label: 'שיבוצים יומיים', icon: CalendarDays },
  { to: '/calendar', label: 'יומן', icon: BookOpen },
  { to: '/students', label: 'תלמידים וצוות', icon: GraduationCap },
  { to: '/workplaces', label: 'מקומות עבודה', icon: Building2 },
  { to: '/roles', label: 'תפקידים', icon: ShieldCheck },
  { to: '/vehicles', label: 'רכבים', icon: Truck },
  { to: '/reports', label: 'דוחות', icon: BarChart2 },
  { to: '/absence-requests', label: 'בקשות היעדרות', icon: MessageSquare },
  { to: '/time-reports', label: 'עדכון זמנים', icon: ClipboardCheck },
];

export default function Layout() {
  const location = useLocation();

  const { data: pendingSMS = [] } = useQuery({
    queryKey: ['incoming-sms-pending'],
    queryFn: () => base44.entities.IncomingSMS.filter({ status: 'ממתין' }, '-created_date', 100),
    refetchInterval: 60000,
  });
  const pendingCount = pendingSMS.length;

  const { data: pendingTimeReports = [] } = useQuery({
    queryKey: ['time-reports-pending'],
    queryFn: () => base44.entities.TimeReport.filter({ status: 'ממתין' }, '-created_date', 100),
    refetchInterval: 60000,
  });
  const pendingTimeReportsCount = pendingTimeReports.length;

  return (
    <div className="flex min-h-screen bg-background font-heebo" dir="rtl">
      {/* Sidebar */}
      <aside className="sidebar-bg w-64 flex-shrink-0 flex flex-col shadow-xl">
        <div className="px-6 py-7 border-b border-white/10">
          <h1 className="text-white text-xl font-bold tracking-wide">מערכת שיבוצים</h1>
          <p className="text-white/50 text-xs mt-1">ניהול תלמידים ומקומות עבודה</p>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {to === '/absence-requests' && pendingCount > 0 && (
                  <span className="bg-destructive text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
                {to === '/time-reports' && pendingTimeReportsCount > 0 && (
                  <span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {pendingTimeReportsCount > 9 ? '9+' : pendingTimeReportsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-5 border-t border-white/10">
          <p className="text-white/30 text-xs">גרסה 1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}