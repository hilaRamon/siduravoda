/** Permission helpers shared by API middleware */

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
};

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

export function canReportTime(user) {
  return isAdmin(user) || user?.can_report_time === true;
}

export function canViewTimeReports(user) {
  return isAdmin(user) || user?.role === "user" || user?.can_view_time_reports === true;
}

export function canAccessMainApp(user) {
  if (!user?.is_active) return false;
  return isAdmin(user) || user.role === ROLES.USER;
}

export function levelToFields(level) {
  switch (level) {
    case "admin":
      return {
        role: ROLES.ADMIN,
        can_report_time: false,
        can_view_time_reports: false,
      };
    case "reporter":
      return {
        role: ROLES.USER,
        can_report_time: true,
        can_view_time_reports: false,
      };
    default:
      return {
        role: ROLES.USER,
        can_report_time: false,
        can_view_time_reports: false,
      };
  }
}

export function sanitizeUser(doc) {
  if (!doc) return null;
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  delete json.password_hash;
  return json;
}
