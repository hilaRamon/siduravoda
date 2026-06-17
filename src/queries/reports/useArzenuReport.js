import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { reportKeys } from "./keys";

/**
 * @typedef {Object} ArzenuReportParams
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {boolean} [enabled]
 */

/**
 * @param {ArzenuReportParams} [params]
 */
export function useArzenuReport({
  startDate,
  endDate,
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: reportKeys.arzenu({ startDate, endDate }),
    queryFn: () => base44.reports.arzenu({ startDate, endDate }),
    enabled: enabled && !!startDate && !!endDate,
  });
}
