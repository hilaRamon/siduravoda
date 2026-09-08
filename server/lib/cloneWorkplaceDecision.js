export const NOT_WORKING_WORKPLACE_NAME = "תתת - לא עובד";
export const PRE_ASSIGNMENT_WORKPLACE_NAME = "אאא- לפני שיבוץ";
export const DISTANCE_WORKPLACE_NAMES = [
  "קרוב",
  "רחוק",
  NOT_WORKING_WORKPLACE_NAME,
  PRE_ASSIGNMENT_WORKPLACE_NAME,
];
export const DAY_NUM_TO_HEB = { 0: "א", 1: "ב", 2: "ג", 3: "ד", 4: "ה" };

export class CloneWorkplaceError extends Error {
  constructor(message) {
    super(message);
    this.name = "CloneWorkplaceError";
  }
}

function requireWorkplace(wp, name) {
  if (!wp?.id) {
    throw new CloneWorkplaceError(`מקום העבודה "${name}" לא נמצא`);
  }
  return { id: wp.id, name: wp.name };
}

function workplaceFromSource(src, preAssignmentWp) {
  if (src.workplace_name === NOT_WORKING_WORKPLACE_NAME) {
    return requireWorkplace(preAssignmentWp, PRE_ASSIGNMENT_WORKPLACE_NAME);
  }
  if (!src.workplace_id) return null;
  return { id: src.workplace_id, name: src.workplace_name };
}

/**
 * Decide the target workplace for one source assignment.
 * Returns null to skip (leave unassigned).
 */
export function decideCloneWorkplace({
  src,
  student,
  isSunday,
  targetDayHeb,
  isAbsent,
  distanceWorkplaceMap,
  notWorkingWp,
  preAssignmentWp,
}) {
  if (student?.is_active === false) return null;

  const isCrew = student?.cohort?.includes("צוות");

  if (isAbsent) {
    return requireWorkplace(notWorkingWp, NOT_WORKING_WORKPLACE_NAME);
  }

  if (isSunday) {
    const distanceStatus = student?.distance_status;
    if (distanceStatus && distanceWorkplaceMap[distanceStatus]) {
      return distanceWorkplaceMap[distanceStatus];
    }
    return workplaceFromSource(src, preAssignmentWp);
  }

  if (isCrew && targetDayHeb) {
    const freeDays = Array.isArray(student?.free_day)
      ? student.free_day
      : student?.free_day
        ? [student.free_day]
        : [];
    if (freeDays.includes(targetDayHeb)) {
      return requireWorkplace(notWorkingWp, NOT_WORKING_WORKPLACE_NAME);
    }
    return null;
  }

  return workplaceFromSource(src, preAssignmentWp);
}
