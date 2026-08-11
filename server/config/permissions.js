/** Permission helpers shared by API middleware */

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  WORKPLACE_MANAGER: "workplace_manager",
  REPORTER: "reporter",
};

export const INVITEABLE_ROLES = [
  ROLES.USER,
  ROLES.REPORTER,
  ROLES.WORKPLACE_MANAGER,
];

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

export function isRegularUser(user) {
  return user?.role === ROLES.USER;
}

export function isReporterOnly(user) {
  return user?.role === ROLES.REPORTER;
}

export function isWorkplaceManagerOnly(user) {
  return user?.role === ROLES.WORKPLACE_MANAGER;
}

export function canReportTime(user) {
  return user?.can_report_time === true;
}

export function canViewTimeReports(user) {
  return user?.can_view_time_reports === true;
}

export function canApproveTimeReports(user) {
  return user?.can_approve_time_reports === true;
}

export function canAccessWorkplacesApp(user) {
  return user?.can_manage_workplaces === true;
}

export function canAccessAdminTools(user) {
  return user?.can_access_admin_tools === true;
}

export function canAccessMainApp(user) {
  if (!user?.is_active) return false;
  return user?.can_access_main_app === true;
}

export function getManageUsersLevel(user) {
  return user?.can_manage_users || "none";
}

export function getAllowedInviteRoles(user) {
  const level = getManageUsersLevel(user);
  if (level === "all") {
    return new Set(INVITEABLE_ROLES);
  }
  if (level === "limited") {
    return new Set([ROLES.REPORTER, ROLES.WORKPLACE_MANAGER]);
  }
  return new Set();
}

export function sanitizeUser(doc) {
  if (!doc) return null;
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  delete json.password_hash;
  // Legacy User fields — permissions come from PermissionRule hydration
  delete json.can_report_time;
  delete json.can_view_time_reports;
  delete json.can_manage_workplaces;
  return json;
}
