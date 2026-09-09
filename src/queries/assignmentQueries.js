import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentApi } from "@/api/assignmentApi";
import { assignmentWorkNumber } from "@/lib/assignmentHelpers";

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
    mutationFn: ({ sourceDate, targetDate }) =>
      assignmentApi.clone({ sourceDate, targetDate }),
    onSuccess: () => {
      invalidateAssignmentQueries(queryClient);
    },
  });
}
