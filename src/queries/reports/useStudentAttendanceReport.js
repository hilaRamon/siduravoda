import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/reportApi";
import { reportKeys } from "./keys";

/**
 * @param {{ startDate?: string, endDate?: string, students?: string[], enabled?: boolean }} [params]
 */
export function useStudentAttendanceReport({
  startDate,
  endDate,
  students = undefined,
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: reportKeys.studentAttendance({ startDate, endDate, students }),
    queryFn: () =>
      reportApi.studentAttendance({ startDate, endDate, students }),
    enabled: enabled && !!startDate && !!endDate,
  });
}
