import { showAlert } from "@/components/AppAlert";

export const NOT_WORKING_WORKPLACE_NAME = "תתת - לא עובד";
export const PRE_ASSIGNMENT_WORKPLACE_NAME = "אאא- לפני שיבוץ";
export const REQUEST_FULFILLED_SNACKBAR_MS = 4000;

export function dedupeLatestAssignments(assignmentList) {
  const byStudent = {};
  assignmentList.forEach((a) => {
    const existing = byStudent[a.student_id];
    if (
      !existing ||
      (a.updated_date || a.created_date) >
        (existing.updated_date || existing.created_date)
    ) {
      byStudent[a.student_id] = a;
    }
  });
  return Object.values(byStudent);
}

export function countStudentsAtWorkplace(assignmentList, workplaceId) {
  return dedupeLatestAssignments(assignmentList).filter(
    (a) => a.workplace_id === workplaceId,
  ).length;
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
 * @returns {{ toCreate: object[], toUpdate: { id: string, fullRecord: object }[], skippedAbsent: number }}
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
}) {
  const assignmentById = {};
  const assignmentByStudentId = {};
  assignments.forEach((a) => {
    assignmentById[a.id] = a;
    assignmentByStudentId[a.student_id] = a;
  });
  const studentById = {};
  students.forEach((s) => {
    studentById[s.id] = s;
  });

  const toCreate = [];
  const toUpdate = [];
  let skippedAbsent = 0;

  for (const selId of selectedIds) {
    const existingAssignment =
      assignmentById[selId] || assignmentByStudentId[selId];
    const studentId = existingAssignment?.student_id || selId;
    const isAbsent = !!absentByStudentId[studentId];
    const changingWorkplace = wp && wp.name !== NOT_WORKING_WORKPLACE_NAME;

    if (isAbsent && changingWorkplace) {
      skippedAbsent++;
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
      if (bulkRate !== "") {
        const parsedRate = parseFloat(bulkRate);
        fullRecord.rate = dailyMode ? parseRateInput(parsedRate) : parsedRate;
      }
      toUpdate.push({ id, fullRecord });
    } else if (wp) {
      const student = studentById[selId];
      if (student) {
        toCreate.push({
          date,
          student_id: student.id,
          student_name: student.full_name,
          workplace_id: wp.id,
          workplace_name: wp.name,
          rate:
            bulkRate !== ""
              ? dailyMode
                ? parseRateInput(parseFloat(bulkRate))
                : parseFloat(bulkRate)
              : defaults.rate,
          hours: bulkHours !== "" ? parseFloat(bulkHours) : defaults.hours,
        });
      }
    }
  }

  return { toCreate, toUpdate, skippedAbsent };
}
