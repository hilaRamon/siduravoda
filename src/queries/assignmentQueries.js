import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { absenceApi } from "@/api/absenceApi";
import { base44 } from "@/api/base44Client";
import {
  NOT_WORKING_WORKPLACE_NAME,
  PRE_ASSIGNMENT_WORKPLACE_NAME,
} from "@/lib/assignmentHelpers";

export const assignmentKeys = {
  all: ["assignments"],
  byDate: (date) => [...assignmentKeys.all, date],
};

function invalidateAssignmentQueries(queryClient, date) {
  if (date) {
    queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
  } else {
    queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
  }
}

export function useAssignments(date, options = {}) {
  return useQuery({
    queryKey: assignmentKeys.byDate(date),
    queryFn: () =>
      base44.entities.Assignment.filter({ date }, "-created_date", 2000),
    ...options,
  });
}

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, any>}
 */
export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => base44.entities.Assignment.create(data),
    onSuccess: (_result, variables) => {
      invalidateAssignmentQueries(queryClient, variables?.date);
    },
  });
}

/**
 * @typedef {object} AssignmentUpdateInput
 * @property {string} id
 * @property {Record<string, unknown>} data
 * @property {string} [date]
 */

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, AssignmentUpdateInput>}
 */
export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (/** @type {AssignmentUpdateInput} */ vars) =>
      base44.entities.Assignment.update(vars.id, vars.data),
    onSuccess: (_result, variables) => {
      invalidateAssignmentQueries(queryClient, variables?.date);
    },
  });
}

/**
 * @typedef {object} AssignmentDeleteInput
 * @property {string} id
 * @property {string} [date]
 */

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, AssignmentDeleteInput>}
 */
export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (/** @type {AssignmentDeleteInput} */ vars) =>
      base44.entities.Assignment.delete(vars.id),
    onSuccess: (_result, variables) => {
      invalidateAssignmentQueries(queryClient, variables?.date);
    },
  });
}

/**
 * @typedef {object} AssignStudentInput
 * @property {string} date
 * @property {{ id: string, full_name: string }} student
 * @property {{ id: string, name: string }} workplace
 * @property {Array<{ id: string, student_id: string }>} assignments
 * @property {{ rate: number, hours: number }} defaults
 */

/**
 * Create or update a student's workplace assignment for a date,
 * deleting duplicate rows when present.
 * @returns {import('@tanstack/react-query').UseMutationResult<void, Error, AssignStudentInput>}
 */
export function useAssignStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (/** @type {AssignStudentInput} */ input) => {
      const { date, student, workplace, assignments, defaults } = input;
      const allForStudent = assignments.filter(
        (a) => a.student_id === student.id,
      );

      if (allForStudent.length > 1) {
        const [keep, ...extras] = allForStudent;
        await Promise.all(
          extras.map((a) => base44.entities.Assignment.delete(a.id)),
        );
        await base44.entities.Assignment.update(keep.id, {
          workplace_id: workplace.id,
          workplace_name: workplace.name,
        });
        return;
      }

      if (allForStudent.length === 1) {
        await base44.entities.Assignment.update(allForStudent[0].id, {
          workplace_id: workplace.id,
          workplace_name: workplace.name,
        });
        return;
      }

      await base44.entities.Assignment.create({
        date,
        student_id: student.id,
        student_name: student.full_name,
        workplace_id: workplace.id,
        workplace_name: workplace.name,
        rate: defaults.rate,
        hours: defaults.hours,
      });
    },
    onSuccess: (_result, variables) => {
      invalidateAssignmentQueries(queryClient, variables?.date);
    },
  });
}

async function bulkUpdateAssignments({ toCreate = [], toUpdate = [] }) {
  await Promise.all(
    toUpdate.map(({ id, fullRecord }) =>
      base44.entities.Assignment.update(id, fullRecord),
    ),
  );
  if (toCreate.length > 0) {
    await base44.entities.Assignment.bulkCreate(toCreate);
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Chunked create + update for bulk edit dialog.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, any>}
 */
export function useBulkUpsertAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ toCreate = [], toUpdate = [], onProgress }) => {
      const CHUNK_SIZE = 5;
      const totalOps =
        Math.ceil(toCreate.length / CHUNK_SIZE) +
        Math.ceil(toUpdate.length / CHUNK_SIZE);
      let doneOps = 0;

      for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
        await Promise.all(
          toCreate
            .slice(i, i + CHUNK_SIZE)
            .map((record) => base44.entities.Assignment.create(record)),
        );
        doneOps++;
        onProgress?.(Math.round((doneOps / Math.max(totalOps, 1)) * 100));
        if (i + CHUNK_SIZE < toCreate.length) await delay(300);
      }
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        await Promise.all(
          toUpdate
            .slice(i, i + CHUNK_SIZE)
            .map(({ id, fullRecord }) =>
              base44.entities.Assignment.update(id, fullRecord),
            ),
        );
        doneOps++;
        onProgress?.(Math.round((doneOps / Math.max(totalOps, 1)) * 100));
        if (i + CHUNK_SIZE < toUpdate.length) await delay(300);
      }
      onProgress?.(100);
      await delay(400);
    },
    onSuccess: (_result, variables) => {
      invalidateAssignmentQueries(queryClient, variables?.date);
    },
  });
}

/**
 * Clone source-day assignments onto a target date.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, any>}
 */
export function useCloneDayAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sourceAssignments,
      targetDate,
      workplaces,
      defaults,
      onProgress,
    }) => {
      const report = (progress, step) => onProgress?.({ progress, step });

      const targetDayOfWeek = new Date(targetDate + "T12:00:00").getDay();
      const isSunday = targetDayOfWeek === 0;

      const DISTANCE_WORKPLACE_MAP = {};
      [
        "קרוב",
        "רחוק",
        NOT_WORKING_WORKPLACE_NAME,
        PRE_ASSIGNMENT_WORKPLACE_NAME,
      ].forEach((distStatus) => {
        const wp = workplaces.find((w) => w.name === distStatus);
        if (wp) {
          DISTANCE_WORKPLACE_MAP[distStatus] = { id: wp.id, name: wp.name };
        }
      });

      report(10, "טוען תלמידים...");
      const freshStudents = await base44.entities.Student.list(
        "-created_date",
        2000,
      );
      const studentById = {};
      freshStudents.forEach((s) => {
        studentById[s.id] = s;
      });

      report(25, "בודק היעדרויות...");
      const approvedAbsences = await absenceApi.list({
        startDate: targetDate,
        endDate: targetDate,
        status: "אושר",
      });
      const absentStudentIds = new Set(
        approvedAbsences.map((a) => a.student_id).filter(Boolean),
      );

      report(40, "טוען שיבוצים קיימים...");
      const targetAssignments = await base44.entities.Assignment.filter(
        { date: targetDate },
        "-created_date",
        2000,
      );

      const targetByStudent = {};
      targetAssignments.forEach((a) => {
        const existing = targetByStudent[a.student_id];
        if (
          !existing ||
          (a.updated_date || a.created_date) >
            (existing.updated_date || existing.created_date)
        ) {
          targetByStudent[a.student_id] = a;
        }
      });

      report(50, "מנקה כפילויות...");
      const duplicatesToDelete = [];
      const seenOnTarget = new Set();
      [...targetAssignments]
        .sort((a, b) =>
          (b.updated_date || b.created_date) >
          (a.updated_date || a.created_date)
            ? 1
            : -1,
        )
        .forEach((a) => {
          if (seenOnTarget.has(a.student_id)) {
            duplicatesToDelete.push(a.id);
          } else {
            seenOnTarget.add(a.student_id);
          }
        });
      for (const id of duplicatesToDelete) {
        await base44.entities.Assignment.delete(id);
      }

      const DAY_NUM_TO_HEB = { 0: "א", 1: "ב", 2: "ג", 3: "ד", 4: "ה" };
      const targetDayHeb = DAY_NUM_TO_HEB[targetDayOfWeek];
      const notWorkingWp = workplaces.find(
        (w) => w.name === NOT_WORKING_WORKPLACE_NAME,
      );

      const toUpdate = [];
      const toCreate = [];

      report(60, "מכין שיבוצים...");

      for (const src of sourceAssignments) {
        const student = studentById[src.student_id];
        const isCrew = student?.cohort?.includes("צוות");

        let targetWp;
        if (absentStudentIds.has(src.student_id)) {
          targetWp = notWorkingWp
            ? { id: notWorkingWp.id, name: notWorkingWp.name }
            : { id: "", name: NOT_WORKING_WORKPLACE_NAME };
        } else if (isSunday) {
          const distanceStatus = student?.distance_status;
          if (distanceStatus && DISTANCE_WORKPLACE_MAP[distanceStatus]) {
            targetWp = DISTANCE_WORKPLACE_MAP[distanceStatus];
          } else {
            targetWp = { id: src.workplace_id, name: src.workplace_name };
          }
        } else if (isCrew && targetDayHeb) {
          const freeDays = Array.isArray(student?.free_day)
            ? student.free_day
            : student?.free_day
              ? [student.free_day]
              : [];
          if (freeDays.includes(targetDayHeb)) {
            targetWp = notWorkingWp
              ? { id: notWorkingWp.id, name: notWorkingWp.name }
              : { id: src.workplace_id, name: NOT_WORKING_WORKPLACE_NAME };
          } else {
            targetWp = { id: "", name: "" };
          }
        } else {
          targetWp = { id: src.workplace_id, name: src.workplace_name };
        }

        const existing = targetByStudent[src.student_id];
        if (existing) {
          toUpdate.push({
            id: existing.id,
            fullRecord: {
              workplace_id: targetWp.id,
              workplace_name: targetWp.name,
              role: null,
              bonus: null,
            },
          });
        } else {
          toCreate.push({
            date: targetDate,
            student_id: src.student_id,
            student_name: src.student_name,
            workplace_id: targetWp.id,
            workplace_name: targetWp.name,
            rate: defaults.rate,
            hours: defaults.hours,
            role: null,
            bonus: null,
          });
        }
      }

      const CHUNK = 40;
      for (let i = 0; i < toUpdate.length; i += CHUNK) {
        await bulkUpdateAssignments({
          toCreate: [],
          toUpdate: toUpdate.slice(i, i + CHUNK),
        });
      }
      if (toCreate.length > 0) {
        await bulkUpdateAssignments({ toCreate, toUpdate: [] });
      }

      report(100, "");
      return { created: toCreate.length, updated: toUpdate.length };
    },
    onSuccess: () => {
      invalidateAssignmentQueries(queryClient);
    },
  });
}
