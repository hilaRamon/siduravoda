import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
      base44.reports.workByWorkplace({
        startDate,
        endDate,
        workplaces,
        farms,
        groupBy,
      }),
    enabled: enabled && !!startDate && !!endDate,
  });
}
