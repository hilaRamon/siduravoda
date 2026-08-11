import * as permissionRuleRepository from "../repositories/permissionRuleRepository.js";
import {
  PERMISSION_ROLES,
  MANAGE_USERS_LEVELS,
} from "../models/PermissionRule.js";

export class PermissionRuleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PermissionRuleError";
    this.status = status;
  }
}

const PERMISSION_FIELDS = [
  "label_he",
  "can_access_main_app",
  "can_manage_workplaces",
  "can_report_time",
  "can_view_time_reports",
  "can_approve_time_reports",
  "can_access_admin_tools",
  "can_manage_users",
];

/** @type {Map<string, object>|null} */
let rulesByRoleCache = null;

export const DEFAULT_PERMISSION_RULES = [
  {
    role: "admin",
    label_he: "מנהל מערכת",
    can_access_main_app: true,
    can_manage_workplaces: true,
    can_report_time: true,
    can_view_time_reports: true,
    can_approve_time_reports: true,
    can_access_admin_tools: true,
    can_manage_users: "all",
  },
  {
    role: "user",
    label_he: "משתמש",
    can_access_main_app: true,
    can_manage_workplaces: true,
    can_report_time: false,
    can_view_time_reports: true,
    can_approve_time_reports: false,
    can_access_admin_tools: true,
    can_manage_users: "limited",
  },
  {
    role: "workplace_manager",
    label_he: "מנהל מקומות עבודה",
    can_access_main_app: false,
    can_manage_workplaces: true,
    can_report_time: false,
    can_view_time_reports: false,
    can_approve_time_reports: false,
    can_access_admin_tools: false,
    can_manage_users: "none",
  },
  {
    role: "reporter",
    label_he: "מדווח זמנים",
    can_access_main_app: false,
    can_manage_workplaces: false,
    can_report_time: true,
    can_view_time_reports: false,
    can_approve_time_reports: false,
    can_access_admin_tools: false,
    can_manage_users: "none",
  },
];

export function clearPermissionRuleCache() {
  rulesByRoleCache = null;
}

async function loadCache() {
  if (rulesByRoleCache) return rulesByRoleCache;
  const all = await permissionRuleRepository.findAll();
  rulesByRoleCache = new Map(all.map((rule) => [rule.role, rule]));
  return rulesByRoleCache;
}

export async function ensurePermissionRulesSeeded() {
  for (const rule of DEFAULT_PERMISSION_RULES) {
    const existing = await permissionRuleRepository.findByRole(rule.role);
    if (!existing) {
      await permissionRuleRepository.upsertByRole(rule.role, rule);
    }
  }
  clearPermissionRuleCache();
}

export async function listPermissionRules() {
  return permissionRuleRepository.findAll();
}

export async function getPermissionRule(id) {
  const item = await permissionRuleRepository.findById(id);
  if (!item) {
    throw new PermissionRuleError("Permission rule not found", 404);
  }
  return item;
}

export async function getPermissionRuleByRole(role) {
  if (!PERMISSION_ROLES.includes(role)) {
    throw new PermissionRuleError("Unknown role", 400);
  }

  const cache = await loadCache();
  if (cache.has(role)) {
    return cache.get(role);
  }

  const item = await permissionRuleRepository.findByRole(role);
  if (!item) {
    const fallback = DEFAULT_PERMISSION_RULES.find((r) => r.role === role);
    if (fallback) return { ...fallback };
    throw new PermissionRuleError("Permission rule not found", 404);
  }
  cache.set(role, item);
  return item;
}

function pickUpdatableFields(body = {}) {
  const payload = {};
  for (const key of PERMISSION_FIELDS) {
    if (body[key] !== undefined) {
      payload[key] = body[key];
    }
  }

  if (
    payload.can_manage_users !== undefined &&
    !MANAGE_USERS_LEVELS.includes(payload.can_manage_users)
  ) {
    throw new PermissionRuleError(
      `can_manage_users must be one of: ${MANAGE_USERS_LEVELS.join(", ")}`,
    );
  }

  if (payload.label_he !== undefined) {
    payload.label_he = String(payload.label_he || "").trim();
    if (!payload.label_he) {
      throw new PermissionRuleError("label_he is required");
    }
  }

  for (const key of PERMISSION_FIELDS) {
    if (key === "label_he" || key === "can_manage_users") continue;
    if (payload[key] !== undefined && typeof payload[key] !== "boolean") {
      throw new PermissionRuleError(`${key} must be a boolean`);
    }
  }

  return payload;
}

export async function updatePermissionRule(id, body) {
  const existing = await permissionRuleRepository.findById(id);
  if (!existing) {
    throw new PermissionRuleError("Permission rule not found", 404);
  }

  const payload = pickUpdatableFields(body);
  if (Object.keys(payload).length === 0) {
    throw new PermissionRuleError("No valid fields to update");
  }

  const updated = await permissionRuleRepository.updateById(id, payload);
  clearPermissionRuleCache();
  return updated;
}

/** Merge PermissionRule fields onto a sanitized user object */
export function hydrateUserPermissions(user, rule) {
  if (!user) return null;
  if (!rule) return user;
  return {
    ...user,
    can_access_main_app: rule.can_access_main_app === true,
    can_manage_workplaces: rule.can_manage_workplaces === true,
    can_report_time: rule.can_report_time === true,
    can_view_time_reports: rule.can_view_time_reports === true,
    can_approve_time_reports: rule.can_approve_time_reports === true,
    can_access_admin_tools: rule.can_access_admin_tools === true,
    can_manage_users: rule.can_manage_users || "none",
    role_label_he: rule.label_he,
  };
}

export async function hydrateUser(user) {
  if (!user?.role) return user;
  try {
    const rule = await getPermissionRuleByRole(user.role);
    return hydrateUserPermissions(user, rule);
  } catch {
    const fallback = DEFAULT_PERMISSION_RULES.find((r) => r.role === user.role);
    return hydrateUserPermissions(user, fallback || null);
  }
}
