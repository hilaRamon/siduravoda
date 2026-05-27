import {
  canReportTime,
  canViewTimeReports,
  isAdmin,
} from "../config/permissions.js";

/** Public entity reads (no login) */
function isPublicRead(entityName, req) {
  if (entityName !== "PublishedSchedule") return false;
  return req.method === "GET";
}

function isReadMethod(method) {
  return method === "GET" || method === "POST"; // POST used for /filter
}

/** Time reporters: submit times only; read assignments/logistics for the form */
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

  if (entityName === "User") {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    return next();
  }

  if (entityName === "TimeReport") {
    if (isAdmin(req.user)) return next();

    if (isReadMethod(method)) {
      if (canViewTimeReports(req.user) || canReportTime(req.user)) {
        return next();
      }
      return res.status(403).json({ message: "No permission to view time reports" });
    }

    if (method === "PATCH" || method === "POST") {
      if (canReportTime(req.user)) return next();
      return res.status(403).json({ message: "No permission to submit time reports" });
    }

    if (method === "DELETE") {
      return res.status(403).json({ message: "Admin access required" });
    }
  }

  // All other entities: any active authenticated user
  return next();
}
