import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/reportApi";
import { reportKeys } from "./keys";

/**
 * @typedef {Object} StudentWorkReportParams
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {string[]} [students]
 * @property {boolean} [enabled]
 */

/**
 * @param {StudentWorkReportParams} [params]
 */
export function useStudentWorkReport({
  startDate,
  endDate,
  students = undefined,
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: reportKeys.studentWork({ startDate, endDate, students }),
    queryFn: () =>
      reportApi.studentWork({ startDate, endDate, students }),
    enabled: enabled && !!startDate && !!endDate,
  });
}
