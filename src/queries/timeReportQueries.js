import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timeReportApi } from "@/api/timeReportApi";
import { assignmentKeys } from "@/queries/assignmentQueries";

export const timeReportKeys = {
  all: ["time-reports"],
  byDate: (date) => [...timeReportKeys.all, "date", date],
  pending: ({ sort, limit }) => [...timeReportKeys.all, "pending", { sort, limit }],
};

function invalidateTimeReportQueries(queryClient, date) {
  queryClient.invalidateQueries({ queryKey: timeReportKeys.all });
  if (date) {
    queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
  }
}

export function useTimeReportsByDate(date, options = {}) {
  return useQuery({
    queryKey: timeReportKeys.byDate(date),
    queryFn: () =>
      timeReportApi.list({ date, sort: "student_name", limit: 500 }),
    enabled: !!date,
    ...options,
  });
}

export function usePendingTimeReports({
  sort = "date",
  limit = 2000,
  ...options
} = {}) {
  return useQuery({
    queryKey: timeReportKeys.pending({ sort, limit }),
    queryFn: () => timeReportApi.list({ status: "ממתין", sort, limit }),
    refetchInterval: 60000,
    ...options,
  });
}

/**
 * @typedef {{ date?: string } & Record<string, unknown>} CreateTimeReportInput
 */

export function useCreateTimeReport() {
  const queryClient = useQueryClient();
  return useMutation({
    /** @param {CreateTimeReportInput} data */
    mutationFn: (data) => timeReportApi.create(data),
    onSuccess: (_result, variables) => {
      invalidateTimeReportQueries(queryClient, variables?.date);
    },
  });
}

/**
 * @typedef {object} UpdateTimeReportInput
 * @property {string} id
 * @property {Record<string, unknown>} data
 * @property {string} [date]
 */

export function useUpdateTimeReport() {
  const queryClient = useQueryClient();
  return useMutation({
    /** @param {UpdateTimeReportInput} variables */
    mutationFn: ({ id, data }) => timeReportApi.update(id, data),
    onSuccess: (_result, variables) => {
      invalidateTimeReportQueries(queryClient, variables?.date ?? variables?.data?.date);
    },
  });
}

/**
 * @typedef {{ ids: string[], status: string, date?: string, reportId?: string, workplaceId?: string }} BulkTimeReportStatusInput
 */

export function useBulkTimeReportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    /** @param {BulkTimeReportStatusInput} variables */
    mutationFn: ({ ids, status }) => timeReportApi.bulkStatus({ ids, status }),
    onSuccess: (_result, variables) => {
      invalidateTimeReportQueries(queryClient, variables?.date);
    },
  });
}

export function useApproveTimeReportDate() {
  const queryClient = useQueryClient();
  return useMutation({
    /** @param {string} date */
    mutationFn: (date) => timeReportApi.approveDate(date),
    onSuccess: (_result, date) => {
      invalidateTimeReportQueries(queryClient, date);
    },
  });
}
