import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { workplaceApi } from "@/api/workplaceApi";
import { useFarms } from "@/queries/farmQueries";
import { reportKeys } from "./keys";

export function useWorkplaces() {
  const query = useQuery({
    queryKey: reportKeys.workplaces(),
    queryFn: () => workplaceApi.list({ sort: "name", limit: 1000 }),
  });
  const farmsQuery = useFarms();

  const farmNames = useMemo(() => {
    const names = (farmsQuery.data ?? []).map((farm) => farm.name).filter(Boolean);
    return [...names].sort((a, b) => a.localeCompare(b, "he"));
  }, [farmsQuery.data]);

  return {
    ...query,
    isLoading: query.isLoading || farmsQuery.isLoading,
    workplaces: query.data ?? [],
    farmNames,
  };
}
