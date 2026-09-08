import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentApi } from "@/api/assignmentApi";

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
        await Promise.all(extras.map((a) => assignmentApi.remove(a.id)));
        await assignmentApi.update(keep.id, {
          workplace_id: workplace.id,
          workplace_name: workplace.name,
        });
        return;
      }

      if (allForStudent.length === 1) {
        await assignmentApi.update(allForStudent[0].id, {
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
        rate: defaults.rate,
        hours: defaults.hours,
      });
    },
    onSuccess: (_result, variables) => {
      invalidateAssignmentQueries(queryClient, variables?.date);
    },
  });
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
            .map((record) => assignmentApi.create(record)),
        );
        doneOps++;
        onProgress?.(Math.round((doneOps / Math.max(totalOps, 1)) * 100));
        if (i + CHUNK_SIZE < toCreate.length) await delay(300);
      }
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        await Promise.all(
          toUpdate
            .slice(i, i + CHUNK_SIZE)
            .map(({ id, fullRecord }) => assignmentApi.update(id, fullRecord)),
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
    mutationFn: ({ sourceDate, targetDate }) =>
      assignmentApi.clone({ sourceDate, targetDate }),
    onSuccess: () => {
      invalidateAssignmentQueries(queryClient);
    },
  });
}
