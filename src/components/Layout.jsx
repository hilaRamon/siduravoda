import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  ShieldCheck,
  GraduationCap,
  BarChart2,
  Truck,
  MessageSquare,
  BookOpen,
  ClipboardCheck,
  Wrench,
  LogOut,
  UserCog,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getVisibleNavItems, isWorkplaceManagerOnly } from "@/lib/permissions";
import EditProfileModal from "@/components/EditProfileModal";

const navIcons = {
  "/": CalendarDays,
  "/calendar": BookOpen,
  "/students": GraduationCap,
  "/workplaces": Building2,
  "/roles": ShieldCheck,
  "/vehicles": Truck,
  "/reports": BarChart2,
  "/admin-tools": Wrench,
  "/absence-requests": MessageSquare,
  "/time-reports": ClipboardCheck,
};

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const workplaceManagerOnly = isWorkplaceManagerOnly(user);
  const navItems = getVisibleNavItems(user);

  const { data: pendingSMS = [] } = useQuery({
    queryKey: ["incoming-sms-pending"],
    queryFn: () =>
      base44.entities.IncomingSMS.filter(
        { status: "ממתין" },
        "-created_date",
        100,
      ),
    refetchInterval: 60000,
    enabled: !workplaceManagerOnly,
  });
  const pendingCount = pendingSMS.length;

  const { data: pendingTimeReports = [] } = useQuery({
    queryKey: ["time-reports-pending"],
    queryFn: () =>
      base44.entities.TimeReport.filter(
        { status: "ממתין" },
        "-created_date",
        100,
      ),
    refetchInterval: 60000,
    enabled: !workplaceManagerOnly && navItems.some((n) => n.to === "/time-reports"),
  });
  const pendingTimeReportsCount = pendingTimeReports.length;

  const handleLogout = () => {
    logout().then(() => {
      window.location.href = "/login";
    });
  };

  if (workplaceManagerOnly) {
    return (
      <div
        className="flex flex-col h-screen bg-background font-heebo overflow-hidden"
        dir="rtl"
      >
        <header className="w-full h-14 flex-shrink-0 border-b border-border bg-card flex items-center justify-between px-6 shadow-sm">
          <div>
            <h1 className="text-lg font-bold">מקומות עבודה</h1>
            {user && (
              <p className="text-xs text-muted-foreground truncate">
                {user.full_name || user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut size={16} />
            התנתקות
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen bg-background font-heebo overflow-hidden"
      dir="rtl"
    >
      <aside className="sidebar-bg w-64 h-full flex-shrink-0 flex flex-col shadow-xl">
        <div className="px-6 py-7 border-b border-white/10">
          <h1 className="text-white text-xl font-bold tracking-wide">
            מערכת שיבוצים
          </h1>
          <p className="text-white/50 text-xs mt-1">
            ניהול תלמידים ומקומות עבודה
          </p>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map(({ to, label }) => {
            const Icon = navIcons[to] || CalendarDays;
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {to === "/absence-requests" && pendingCount > 0 && (
                  <span className="bg-destructive text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
                {to === "/time-reports" && pendingTimeReportsCount > 0 && (
                  <span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {pendingTimeReportsCount > 9
                      ? "9+"
                      : pendingTimeReportsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          {user && (
            <div className="px-2 text-white/70 text-xs truncate">
              {user.full_name || user.email}
            </div>
          )}
          {/* TODO: Add profile edit button */}
          {/* <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <UserCog size={16} />
            עריכת פרופיל
          </button> */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            התנתקות
          </button>
          <p className="text-white/30 text-xs px-2">גרסה 1.0</p>
        </div>
        <EditProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
        />
      </aside>

      <main className="flex-1 h-full overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
