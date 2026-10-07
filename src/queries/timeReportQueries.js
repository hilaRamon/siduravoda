import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
      base44.entities.TimeReport.filter({ date }, "student_name", 500),
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
    queryFn: () =>
      base44.entities.TimeReport.filter({ status: "ממתין" }, sort, limit),
    refetchInterval: 60000,
    ...options,
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
