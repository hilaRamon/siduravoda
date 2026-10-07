import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/reportApi";
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
    queryFn: () => reportApi.arzenu({ startDate, endDate }),
    enabled: enabled && !!startDate && !!endDate,
  });
}
