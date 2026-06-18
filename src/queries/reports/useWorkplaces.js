import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { reportKeys } from "./keys";

export function useWorkplaces() {
  const query = useQuery({
    queryKey: reportKeys.workplaces(),
    queryFn: () => base44.entities.Workplace.list(),
  });

  const farmNames = useMemo(() => {
    const names = new Set(
      (query.data ?? []).map((w) => w.farm_name).filter(Boolean),
    );
    return [...names].sort((a, b) => a.localeCompare(b, "he"));
  }, [query.data]);

  return { ...query, workplaces: query.data ?? [], farmNames };
}
