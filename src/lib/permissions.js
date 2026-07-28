/** Client-side permission helpers (mirror server rules for UI) */

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isRegularUser(user) {
  return (
    user?.role === 'user' &&
    user?.can_report_time !== true &&
    user?.can_manage_workplaces !== true
  );
}

export function isReporterOnly(user) {
  return (
    user?.role === 'user' &&
    user?.can_report_time === true &&
    user?.can_view_time_reports !== true
  );
}

export function isWorkplaceManagerOnly(user) {
  return (
    user?.role === 'user' &&
    user?.can_manage_workplaces === true &&
    user?.can_report_time !== true
  );
}

export function canReportTime(user) {
  return isAdmin(user) || user?.can_report_time === true;
}

export function canViewTimeReports(user) {
  return isAdmin(user) || isRegularUser(user) || user?.can_view_time_reports === true;
}

export function canAccessWorkplacesApp(user) {
  return isAdmin(user) || isRegularUser(user) || isWorkplaceManagerOnly(user);
}

/** Admin tools: admin gets full user management; regular user gets reporter-invite only */
export function canAccessAdminTools(user) {
  return isAdmin(user) || isRegularUser(user);
}

export function canAccessMainApp(user) {
  return user?.is_active !== false && (isAdmin(user) || isRegularUser(user));
}

/** All main-app nav items (path → label) */
export const NAV_ITEMS = [
  { to: '/', label: 'שיבוצים יומיים' },
  { to: '/calendar', label: 'יומן' },
  { to: '/students', label: 'תלמידים וצוות' },
  { to: '/workplaces', label: 'מקומות עבודה' },
  { to: '/roles', label: 'תפקידים' },
  { to: '/vehicles', label: 'רכבים' },
  { to: '/reports', label: 'דוחות' },
  { to: '/absence-requests', label: 'בקשות היעדרות' },
  { to: '/time-reports', label: 'עדכון זמנים' },
  { to: '/admin-tools', label: 'כלי ניהול' },
];

const EXTRA_PAGE_TITLES = {
  '/login': 'התחברות',
  '/schedule': 'סידור יומי',
  '/time-reporting': 'דיווח זמנים',
  '/dashboard': 'לוח בקרה',
};

/** Browser tab title: "סידור עבודה - {page}" */
export function getDocumentTitle(pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  const page =
    NAV_ITEMS.find((n) => n.to === path)?.label ||
    EXTRA_PAGE_TITLES[path];
  return page ? `סידור עבודה - ${page}` : 'סידור עבודה';
}

/** Nav items visible per user */
export function getVisibleNavItems(user) {
  if (isAdmin(user) || isRegularUser(user)) return NAV_ITEMS;
  return [];
}
