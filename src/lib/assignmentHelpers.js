import { showAlert } from "@/components/AppAlert";

export const NOT_WORKING_WORKPLACE_NAME = "תתת - לא עובד";
export const PRE_ASSIGNMENT_WORKPLACE_NAME = "אאא- לפני שיבוץ";
export const REQUEST_FULFILLED_SNACKBAR_MS = 4000;

export function assignmentWorkNumber(assignment) {
  const n = Number(assignment?.work_number);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function isNewerAssignment(candidate, existing) {
  return (
    (candidate.updated_date || candidate.created_date) >
    (existing.updated_date || existing.created_date)
  );
}

/** Keep the latest row per (student_id, work_number). */
export function collapseAssignmentDupes(assignmentList = []) {
  const bySlot = {};
  assignmentList.forEach((a) => {
    if (!a?.student_id) return;
    const key = `${a.student_id}::${assignmentWorkNumber(a)}`;
    const existing = bySlot[key];
    if (!existing || isNewerAssignment(a, existing)) {
      bySlot[key] = a;
    }
  });
  return Object.values(bySlot);
}

export function assignmentsByStudentId(assignmentList = []) {
  const map = {};
  collapseAssignmentDupes(assignmentList).forEach((a) => {
    if (!map[a.student_id]) map[a.student_id] = [];
    map[a.student_id].push(a);
  });
  Object.values(map).forEach((list) => {
    list.sort((a, b) => assignmentWorkNumber(a) - assignmentWorkNumber(b));
  });
  return map;
}

/** One assignment per student: work_number 1 only (latest if duplicates). */
export function dedupeLatestAssignments(assignmentList) {
  const byStudent = {};
  collapseAssignmentDupes(assignmentList).forEach((a) => {
    if (assignmentWorkNumber(a) !== 1) return;
    byStudent[a.student_id] = a;
  });
  return Object.values(byStudent);
}

export function countStudentsAtWorkplace(assignmentList, workplaceId) {
  const ids = new Set();
  collapseAssignmentDupes(assignmentList).forEach((a) => {
    if (a.workplace_id === workplaceId) ids.add(a.student_id);
  });
  return ids.size;
}

/** True if two selected rows belong to the same student. */
export function selectionHasDuplicateStudents(selectedIds, assignments = []) {
  const assignmentById = {};
  assignments.forEach((a) => {
    assignmentById[a.id] = a;
  });
  const seen = new Set();
  for (const selId of selectedIds) {
    const studentId = assignmentById[selId]?.student_id || selId;
    if (seen.has(studentId)) return true;
    seen.add(studentId);
  }
  return false;
}

export function getRequestedVolunteers(farmerRequests, workplaceId) {
  const forWp = farmerRequests.filter((r) => r.workplace_id === workplaceId);
  if (forWp.length === 0) return null;
  let sum = null;
  forWp.forEach((r) => {
    if (r.requested_volunteers != null) {
      sum = (sum ?? 0) + r.requested_volunteers;
    }
  });
  return sum;
}

const NO_AGREEMENT_WARNED_KEY = (date) => `no_agreement_warned_${date}`;

export function getNoAgreementWarnedIds(date) {
  try {
    const raw = localStorage.getItem(NO_AGREEMENT_WARNED_KEY(date));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markNoAgreementWarned(date, workplaceId) {
  const ids = getNoAgreementWarnedIds(date);
  if (ids.includes(workplaceId)) return;
  localStorage.setItem(
    NO_AGREEMENT_WARNED_KEY(date),
    JSON.stringify([...ids, workplaceId]),
  );
}

/** Alert once per workplace per schedule date when assigning to a workplace without agreement.
 *  Returns false if the user does not confirm (ביטול or X) — assignment should not proceed. */
export async function warnIfNoAgreement(date, workplace) {
  if (!workplace || workplace.has_agreement) return true;
  if (getNoAgreementWarnedIds(date).includes(workplace.id)) return true;
  let confirmed = false;
  await showAlert(`ל${workplace.name} אין הסכם`, {
    onConfirm: () => {
      confirmed = true;
    },
    onCancel: () => {
      confirmed = false;
    },
  });
  markNoAgreementWarned(date, workplace.id);
  return confirmed;
}

/**
 * Pure planner for bulk edit — no API calls.
 * @returns {{ toCreate: object[], toUpdate: { id: string, fullRecord: object }[], skippedAbsent: number, skippedUnassigned: number, skippedUnassignedNames: string[], skippedForbidden: number }}
 */
export function buildBulkAssignmentOps({
  selectedIds,
  assignments,
  students,
  absentByStudentId,
  wp,
  bulkHours,
  bulkRate,
  date,
  defaults,
  dailyMode,
  parseRateInput,
  splitWork = false,
}) {
  const assignmentById = {};
  const assignmentByStudentId = {};
  assignments.forEach((a) => {
    assignmentById[a.id] = a;
    const existing = assignmentByStudentId[a.student_id];
    if (!existing || assignmentWorkNumber(a) < assignmentWorkNumber(existing)) {
      assignmentByStudentId[a.student_id] = a;
    }
  });
  const studentById = {};
  students.forEach((s) => {
    studentById[s.id] = s;
  });

  const toCreate = [];
  const toUpdate = [];
  let skippedAbsent = 0;
  const skippedUnassignedNames = [];
  let skippedForbidden = 0;

  const parsedRate =
    bulkRate !== ""
      ? dailyMode
        ? parseRateInput(parseFloat(bulkRate))
        : parseFloat(bulkRate)
      : null;

  for (const selId of selectedIds) {
    const existingAssignment =
      assignmentById[selId] || assignmentByStudentId[selId];
    const studentId = existingAssignment?.student_id || selId;
    const student = studentById[studentId];
    const isAbsent = !!absentByStudentId[studentId];
    const changingWorkplace = wp && wp.name !== NOT_WORKING_WORKPLACE_NAME;

    if (isAbsent && changingWorkplace) {
      skippedAbsent++;
      continue;
    }

    if (splitWork) {
      const isUnassigned =
        !existingAssignment ||
        !wp ||
        existingAssignment.workplace_name === PRE_ASSIGNMENT_WORKPLACE_NAME;
      if (isUnassigned) {
        skippedUnassignedNames.push(
          existingAssignment?.student_name || student?.full_name || "תלמיד",
        );
        continue;
      }
      if (student?.forbidden_workplaces?.includes(wp.id)) {
        skippedForbidden++;
        continue;
      }
      const maxWorkNumber = Math.max(
        0,
        ...assignments
          .filter((a) => a.student_id === existingAssignment.student_id)
          .map(assignmentWorkNumber),
        ...toCreate
          .filter((a) => a.student_id === existingAssignment.student_id)
          .map(assignmentWorkNumber),
      );
      toCreate.push({
        date,
        student_id: existingAssignment.student_id,
        student_name:
          existingAssignment.student_name || student?.full_name || "",
        workplace_id: wp.id,
        workplace_name: wp.name,
        work_number: maxWorkNumber + 1,
        rate: parsedRate ?? existingAssignment.rate ?? defaults.rate,
        hours: bulkHours !== "" ? parseFloat(bulkHours) : defaults.hours,
      });
      continue;
    }

    if (existingAssignment) {
      const { id, created_date, updated_date, created_by, ...rest } =
        existingAssignment;
      const fullRecord = { ...rest };
      if (wp) {
        fullRecord.workplace_id = wp.id;
        fullRecord.workplace_name = wp.name;
      }
      if (bulkHours !== "") fullRecord.hours = parseFloat(bulkHours);
      if (parsedRate !== null) fullRecord.rate = parsedRate;
      toUpdate.push({ id, fullRecord });
    } else if (wp) {
      if (student) {
        toCreate.push({
          date,
          student_id: student.id,
          student_name: student.full_name,
          workplace_id: wp.id,
          workplace_name: wp.name,
          work_number: 1,
          rate: parsedRate ?? defaults.rate,
          hours: bulkHours !== "" ? parseFloat(bulkHours) : defaults.hours,
        });
      }
    }
  }

  return {
    toCreate,
    toUpdate,
    skippedAbsent,
    skippedUnassigned: skippedUnassignedNames.length,
    skippedUnassignedNames,
    skippedForbidden,
  };
}
