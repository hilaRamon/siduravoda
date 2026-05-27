/** Client-side permission helpers (mirror server rules for UI) */

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function canReportTime(user) {
  return isAdmin(user) || user?.can_report_time === true;
}

export function canViewTimeReports(user) {
  return isAdmin(user) || user?.role === 'user' || user?.can_view_time_reports === true;
}

/** Admin tools: admin gets full user management; regular user gets reporter-invite only */
export function canAccessAdminTools(user) {
  return isAdmin(user) || user?.role === 'user';
}

export function canAccessMainApp(user) {
  return user?.is_active !== false && (isAdmin(user) || user?.role === 'user');
}

/** Nav items visible per user */
export function getVisibleNavItems(user) {
  const isRegularUser = user?.role === 'user';

  const all = [
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

  if (isAdmin(user) || isRegularUser) return all;
  return [];
}
