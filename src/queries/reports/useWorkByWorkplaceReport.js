import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/reportApi";
import { reportKeys } from "./keys";

/**
 * @typedef {Object} WorkByWorkplaceReportParams
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {string[]} [workplaces]
 * @property {string[]} [farms]
 * @property {'workplace' | 'farm'} [groupBy]
 * @property {boolean} [enabled]
 */

/**
 * @param {WorkByWorkplaceReportParams} [params]
 */
export function useWorkByWorkplaceReport({
  startDate,
  endDate,
  workplaces = undefined,
  farms = undefined,
  groupBy = undefined,
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: reportKeys.workByWorkplace({
      startDate,
      endDate,
      workplaces,
      farms,
      groupBy,
    }),
    queryFn: () =>
      reportApi.workByWorkplace({
        startDate,
        endDate,
        workplaces,
        farms,
        groupBy,
      }),
    enabled: enabled && !!startDate && !!endDate,
  });
}
