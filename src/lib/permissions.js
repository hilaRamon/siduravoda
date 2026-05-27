/** Client-side permission helpers (mirror server rules for UI) */

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function canReportTime(user) {
  return isAdmin(user) || user?.can_report_time === true;
}

export function canViewTimeReports(user) {
  return isAdmin(user) || user?.can_view_time_reports === true;
}

export function canAccessAdminTools(user) {
  return isAdmin(user);
}

export function canAccessMainApp(user) {
  return user?.is_active !== false && (isAdmin(user) || user?.role === 'user');
}

/** Nav items visible per user */
export function getVisibleNavItems(user) {
  const all = [
    { to: '/', label: 'שיבוצים יומיים', requires: 'main' },
    { to: '/calendar', label: 'יומן', requires: 'main' },
    { to: '/students', label: 'תלמידים וצוות', requires: 'main' },
    { to: '/workplaces', label: 'מקומות עבודה', requires: 'main' },
    { to: '/roles', label: 'תפקידים', requires: 'main' },
    { to: '/vehicles', label: 'רכבים', requires: 'main' },
    { to: '/reports', label: 'דוחות', requires: 'main' },
    { to: '/admin-tools', label: 'כלי ניהול', requires: 'admin' },
    { to: '/absence-requests', label: 'בקשות היעדרות', requires: 'main' },
    { to: '/time-reports', label: 'עדכון זמנים', requires: 'time_reports_view' },
  ];

  return all.filter((item) => {
    if (item.requires === 'admin') return canAccessAdminTools(user);
    if (item.requires === 'time_reports_view') return canViewTimeReports(user);
    if (item.requires === 'main') {
      return isAdmin(user) || (user?.role === 'user' && !user?.can_report_time);
    }
    return true;
  });
}
