import { useMemo } from "react";
import { useWorkplaceLogisticsByDate } from "@/queries/workplaceLogisticsQueries";
import { pickCanonicalLogistics } from "@/lib/assignmentHelpers";

export function useLogisticsByWorkplace(date) {
  const { data: logisticsList = [] } = useWorkplaceLogisticsByDate(date);

  const logisticsMap = useMemo(() => {
    const map = {};
    logisticsList.forEach((l) => {
      map[l.workplace_id] = pickCanonicalLogistics(map[l.workplace_id], l);
    });
    return map;
  }, [logisticsList]);

  return { logisticsList, logisticsMap };
}
