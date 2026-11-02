import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentApi } from "@/api/assignmentApi";
import { assignmentWorkNumber } from "@/lib/assignmentHelpers";

export const assignmentKeys = {
  all: ["assignments"],
  byDate: (date) => [...assignmentKeys.all, date],
};

const calendarRangeKey = [...assignmentKeys.all, "range"];

function invalidateAssignmentQueries(queryClient, date) {
  if (date) {
    queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
  } else {
    queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
  }
}

function patchCalendarRange(queryClient, date, patches) {
  if (!date || !patches?.length) return;
  queryClient.setQueriesData({ queryKey: calendarRangeKey }, (current) => {
    if (!Array.isArray(current)) return current;
    let next = current;
    for (const patch of patches) {
      const workNumber = assignmentWorkNumber(patch);
      const index = next.findIndex((row) => {
        if (row.date !== date) return false;
        if (patch.id && row.id === patch.id) return true;
        return (
          row.student_id === patch.student_id &&
          assignmentWorkNumber(row) === workNumber
        );
      });
      const updatedFields = {
        workplace_id: patch.workplace_id,
        workplace_name: patch.workplace_name,
      };
      if (index === -1) {
        if (!patch.student_id || !patch.workplace_id) continue;
        const created = {
          id: patch.id,
          date,
          student_id: patch.student_id,
          student_name: patch.student_name,
          work_number: workNumber,
          ...updatedFields,
        };
        next = next === current ? [...current, created] : [...next, created];
        continue;
      }
      if (next === current) next = current.slice();
      next[index] = { ...next[index], ...updatedFields };
    }
    return next;
  });
}

function invalidateCalendarRange(queryClient) {
  return queryClient.invalidateQueries({
    queryKey: calendarRangeKey,
    refetchType: "all",
  });
}

function refreshCalendarForWorkplaceChange(queryClient, date, patches) {
  if (!patches?.length) return;
  patchCalendarRange(queryClient, date, patches);
  return invalidateCalendarRange(queryClient);
}

export function useAssignments(date, options = {}) {
  return useQuery({
    queryKey: assignmentKeys.byDate(date),
    queryFn: () =>
      assignmentApi.list({ date, sort: "-created_date", limit: 2000 }),
    enabled: !!date,
    ...options,
  });
}

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, any>}
 */
export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => assignmentApi.create(data),
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
      assignmentApi.update(vars.id, vars.data),
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
      assignmentApi.remove(vars.id),
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
 * @property {Array<{ id: string, student_id: string, work_number?: number }>} assignments
 * @property {{ id: string, student_id: string } | null} [assignment]
 * @property {{ rate: number, hours: number }} defaults
 */

/**
 * Create or update a student's workplace assignment for a date.
 * Updates the given row (or work_number 1) and leaves extra works in place.
 * @returns {import('@tanstack/react-query').UseMutationResult<void, Error, AssignStudentInput>}
 */
export function useAssignStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (/** @type {AssignStudentInput} */ input) => {
      const { date, student, workplace, assignments, assignment, defaults } =
        input;

      if (assignment?.id) {
        await assignmentApi.update(assignment.id, {
          workplace_id: workplace.id,
          workplace_name: workplace.name,
        });
        return;
      }

      const primary = assignments.find(
        (a) =>
          a.student_id === student.id && assignmentWorkNumber(a) === 1,
      );
      if (primary) {
        await assignmentApi.update(primary.id, {
          workplace_id: workplace.id,
          workplace_name: workplace.name,
        });
        return;
      }

      await assignmentApi.create({
        date,
        student_id: student.id,
        student_name: student.full_name,
        workplace_id: workplace.id,
        workplace_name: workplace.name,
        work_number: 1,
        rate: defaults.rate,
        hours: defaults.hours,
      });
    },
    onSuccess: (_result, variables) => {
      invalidateAssignmentQueries(queryClient, variables?.date);
      const { date, student, workplace, assignments = [], assignment } =
        variables || {};
      const target = assignment?.id
        ? assignment
        : assignments.find(
            (row) =>
              row.student_id === student?.id && assignmentWorkNumber(row) === 1,
          );
      refreshCalendarForWorkplaceChange(queryClient, date, [
        {
          id: target?.id,
          student_id: student?.id,
          student_name: student?.full_name,
          workplace_id: workplace?.id,
          workplace_name: workplace?.name,
          work_number: target ? assignmentWorkNumber(target) : 1,
        },
      ]);
    },
  });
}

/**
 * Bulk create and/or update for the bulk edit dialog.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, any>}
 */
export function useBulkUpsertAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ toCreate = [], toUpdate = [] }) => {
      if (toCreate.length) {
        await assignmentApi.bulkCreate(toCreate);
      }
      if (toUpdate.length) {
        await assignmentApi.bulkUpdate(
          toUpdate.map(({ id, fullRecord }) => ({ ...fullRecord, id })),
        );
      }
    },
    onSuccess: (_result, variables) => {
      const { date, toCreate = [], toUpdate = [] } = variables || {};
      const current = queryClient.getQueryData(assignmentKeys.byDate(date));
      invalidateAssignmentQueries(queryClient, date);
      const previousById = new Map(
        (Array.isArray(current) ? current : []).map((row) => [row.id, row]),
      );
      const patches = toCreate.filter((row) => row?.workplace_id);
      for (const { id, fullRecord } of toUpdate) {
        if (!fullRecord?.workplace_id) continue;
        const previous = previousById.get(id);
        if (
          previous &&
          previous.workplace_id === fullRecord.workplace_id &&
          previous.workplace_name === fullRecord.workplace_name
        ) {
          continue;
        }
        if (!previous) continue;
        patches.push({ ...fullRecord, id });
      }
      refreshCalendarForWorkplaceChange(queryClient, date, patches);
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
    mutationFn: ({ sourceDate, targetDate }) =>
      assignmentApi.clone({ sourceDate, targetDate }),
    onSuccess: () => {
      invalidateAssignmentQueries(queryClient);
    },
  });
}
