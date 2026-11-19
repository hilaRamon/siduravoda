export const ATTENDANCE_BUCKET_KEYS = ["didNotLeave", "didNotWork", "studies"];

/** Seed names. Stored lists are workplace ids. */
export const DEFAULT_ATTENDANCE_BUCKETS = {
  didNotLeave: ["לא יצא", "תתצ - לא יצא לעבודה"],
  didNotWork: ["לא עובד", "תתת - לא עובד", "תתת - לא עובד, פנימיה"],
  studies: ["לימודים", "תתב - לימודים", "תתב - לימודים מאוחר"],
};

export const ATTENDANCE_FIELD_BY_KEY = {
  didNotLeave: "attendance_did_not_leave",
  didNotWork: "attendance_did_not_work",
  studies: "attendance_studies",
};

/** Days on this workplace are not an assignment. Resolved by name at report time. */
export const NOT_ASSIGNED_WORKPLACES = ["אאא- לפני שיבוץ"];

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

function cleanTokens(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  const tokens = [];
  for (const item of value) {
    const token = String(item ?? "").trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function sameList(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function idsByWorkplaceName(workplaces) {
  const idsByName = new Map();
  for (const workplace of workplaces) {
    const id = String(workplace?.id ?? "").trim();
    const name = String(workplace?.name ?? "").trim();
    if (!id || !name) continue;
    const list = idsByName.get(name) ?? [];
    list.push(id);
    idsByName.set(name, list);
  }
  return idsByName;
}

/**
 * Missing list → ids of workplaces whose name is in the seed.
 * A saved array, including [], is kept and is not resolved by name again,
 * except a leftover name is converted to the matching workplace ids.
 * An unknown name is dropped. A deleted workplace id stays.
 * An id kept in an earlier column is dropped from the later ones.
 * «אאא- לפני שיבוץ» is never a column member.
 *
 * @returns {{ buckets: Record<string, string[]>, notAssignedIds: string[], changed: boolean, stored: Record<string, string[]> }}
 */
export function resolveAttendanceBuckets(settings = null, workplaces = []) {
  const source = settings || {};
  const idsByName = idsByWorkplaceName(workplaces);
  const claimed = new Set();
  const notAssignedIds = [];

  for (const name of NOT_ASSIGNED_WORKPLACES) {
    for (const id of idsByName.get(name) ?? []) {
      if (claimed.has(id)) continue;
      claimed.add(id);
      notAssignedIds.push(id);
    }
  }

  const buckets = {};
  const stored = {};
  let changed = false;

  for (const key of ATTENDANCE_BUCKET_KEYS) {
    const field = ATTENDANCE_FIELD_BY_KEY[key];
    const saved = cleanTokens(source[field]);
    const tokens = saved ?? DEFAULT_ATTENDANCE_BUCKETS[key];
    const ids = [];
    const seen = new Set();

    for (const token of tokens) {
      const matches = OBJECT_ID_RE.test(token) ? [token] : (idsByName.get(token) ?? []);
      for (const id of matches) {
        if (seen.has(id) || claimed.has(id)) continue;
        seen.add(id);
        claimed.add(id);
        ids.push(id);
      }
    }

    buckets[key] = ids;
    stored[field] = ids;
    if (saved === null || !sameList(saved, ids)) changed = true;
  }

  return { buckets, notAssignedIds, changed, stored };
}

/** @returns {"didNotLeave"|"didNotWork"|"studies"|"worked"|null} */
export function classifyAttendanceWorkplace(workplaceId, buckets, notAssignedIds = []) {
  const id = String(workplaceId ?? "").trim();
  if (!id || notAssignedIds.includes(id)) return null;
  if (buckets.didNotLeave.includes(id)) return "didNotLeave";
  if (buckets.didNotWork.includes(id)) return "didNotWork";
  if (buckets.studies.includes(id)) return "studies";
  return "worked";
}

/** Whole percent. לימודים stays in the denominator only. */
export function attendanceAbsentPercent(didNotLeave, didNotWork, assignedDays) {
  const days = Number(assignedDays);
  if (!Number.isFinite(days) || days <= 0) return 0;
  return Math.round(((Number(didNotLeave) + Number(didNotWork)) / days) * 100);
}
