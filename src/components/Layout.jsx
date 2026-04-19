import { Link, Outlet, useLocation } from 'react-router-dom';
import { Users, Building2, CalendarDays, LayoutDashboard } from 'lucide-react';

const navItems = [
  { to: '/', label: 'לוח בקרה', icon: LayoutDashboard },
  { to: '/students', label: 'סטודנטים', icon: Users },
  { to: '/workplaces', label: 'מקומות עבודה', icon: Building2 },
  { to: '/assignments', label: 'שיבוצים', icon: CalendarDays },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background font-heebo" dir="rtl">
      {/* Sidebar */}
      <aside className="sidebar-bg w-64 flex-shrink-0 flex flex-col shadow-xl">
        <div className="px-6 py-7 border-b border-white/10">
          <h1 className="text-white text-xl font-bold tracking-wide">מערכת שיבוצים</h1>
          <p className="text-white/50 text-xs mt-1">ניהול סטודנטים ומקומות עבודה</p>
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
                {label}
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