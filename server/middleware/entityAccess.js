import { isAdmin } from "../config/permissions.js";

/** Public entity reads (no login) */
function isPublicRead(entityName, req) {
  if (entityName !== "PublishedSchedule") return false;
  return req.method === "GET";
}

function isReadMethod(method) {
  return method === "GET" || method === "POST"; // POST used for /filter
}

/** Reporters: can_report_time users with no broader role access */
function isReporterOnly(user) {
  return (
    user?.role === "user" &&
    user?.can_report_time === true &&
    user?.can_view_time_reports !== true
  );
}

const REPORTER_READ_ENTITIES = new Set([
  "Assignment",
  "WorkplaceLogistics",
  "Workplace",
  "Student",
]);

export function checkEntityAccess(req, res, next) {
  const entityName = req.entityName || req.params.entityName;
  const method = req.method;

  if (isPublicRead(entityName, req)) {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // User entity: admin only
  if (entityName === "User") {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    return next();
  }

  // Admins and regular users (role=user, no reporter flag): full access to all other entities
  const isRegularUser = req.user.role === "user" && !req.user.can_report_time;
  if (isAdmin(req.user) || isRegularUser) {
    return next();
  }

  // Reporter-only users get limited access
  if (isReporterOnly(req.user)) {
    if (entityName === "TimeReport") {
      if (method === "DELETE") {
        return res.status(403).json({ message: "Forbidden" });
      }
      return next();
    }
    if (REPORTER_READ_ENTITIES.has(entityName) && isReadMethod(method)) {
      return next();
    }
    return res.status(403).json({ message: "Reporters can only access time reporting" });
  }

  // Admin (already handled above)
  return next();
}
