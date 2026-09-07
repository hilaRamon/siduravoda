import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studentApi } from "@/api/studentApi";

export const studentKeys = {
  all: ["students"],
};

function invalidateStudentQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: studentKeys.all });
}

export function useStudents(options = {}) {
  const query = useQuery({
    queryKey: studentKeys.all,
    queryFn: () => studentApi.list({ sort: "-created_date" }),
    ...options,
  });

  const students = query.data ?? [];

  const cohorts = useMemo(() => {
    const names = new Set(students.map((s) => s.cohort).filter(Boolean));
    return [...names].sort();
  }, [students]);

  const studentOptions = useMemo(
    () =>
      students
        .filter((s) => s.id && s.full_name)
        .map((s) => ({ id: s.id, name: s.full_name }))
        .sort((a, b) => a.name.localeCompare(b.name, "he")),
    [students],
  );

  const studentNameById = useMemo(
    () => Object.fromEntries(studentOptions.map((s) => [s.id, s.name])),
    [studentOptions],
  );

  return {
    ...query,
    students,
    cohorts,
    studentOptions,
    studentNameById,
  };
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => studentApi.create(data),
    onSuccess: () => invalidateStudentQueries(queryClient),
  });
}

/**
 * @typedef {object} StudentUpdateInput
 * @property {string} id
 * @property {Record<string, unknown>} data
 */

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, StudentUpdateInput>}
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {StudentUpdateInput} */ vars) =>
      studentApi.update(vars.id, vars.data),
    onSuccess: () => invalidateStudentQueries(queryClient),
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => studentApi.remove(id),
    onSuccess: () => invalidateStudentQueries(queryClient),
  });
}

export function useBulkCreateStudents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items) => studentApi.bulkCreate(items),
    onSuccess: () => invalidateStudentQueries(queryClient),
  });
}

/**
 * @typedef {object} RenameCohortInput
 * @property {string} from
 * @property {string} to
 */

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, RenameCohortInput>}
 */
export function useRenameCohort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {RenameCohortInput} */ vars) =>
      studentApi.renameCohort(vars),
    onSuccess: () => invalidateStudentQueries(queryClient),
  });
}
