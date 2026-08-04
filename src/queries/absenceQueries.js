import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { absenceApi } from "@/api/absenceApi";

export const absenceKeys = {
  all: ["absence-requests"],
  list: (filters = {}) => [...absenceKeys.all, "list", filters],
  pending: () => [...absenceKeys.all, "pending"],
  detail: (id) => [...absenceKeys.all, "detail", id],
};

function invalidateAbsenceQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: absenceKeys.all });
  queryClient.invalidateQueries({ queryKey: ["assignments"] });
}

export function useAbsenceRequests(filters = {}, options = {}) {
  return useQuery({
    queryKey: absenceKeys.list(filters),
    queryFn: () => absenceApi.list(filters),
    ...options,
  });
}

export function usePendingAbsenceCount(options = {}) {
  return useQuery({
    queryKey: absenceKeys.pending(),
    queryFn: async () => {
      const items = await absenceApi.list({ status: "ממתין" });
      return items.length;
    },
    refetchInterval: 60000,
    ...options,
  });
}

export function useCreateManualAbsence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => absenceApi.createManual(data),
    onSuccess: () => invalidateAbsenceQueries(queryClient),
  });
}

export function useUpdateAbsence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => absenceApi.update(id, data),
    onSuccess: () => invalidateAbsenceQueries(queryClient),
  });
}

export function useApproveAbsence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, student_id, date }) =>
      absenceApi.approve(id, { student_id, date }),
    onSuccess: () => invalidateAbsenceQueries(queryClient),
  });
}

export function useRejectAbsence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => absenceApi.reject(id),
    onSuccess: () => invalidateAbsenceQueries(queryClient),
  });
}

export function useDeleteAbsence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => absenceApi.remove(id),
    onSuccess: () => invalidateAbsenceQueries(queryClient),
  });
}

export function useBulkAbsenceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status, studentById }) => {
      await Promise.all(
        ids.map((id) => {
          if (status === "אושר") {
            const student_id = studentById?.[id];
            return absenceApi.approve(id, student_id ? { student_id } : {});
          }
          if (status === "נדחה") {
            return absenceApi.reject(id);
          }
          return Promise.resolve();
        }),
      );
    },
    onSuccess: () => invalidateAbsenceQueries(queryClient),
  });
}
