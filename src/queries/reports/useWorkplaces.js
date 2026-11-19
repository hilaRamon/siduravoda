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

  const farms = useMemo(() => {
    return [...(farmsQuery.data ?? [])]
      .filter((farm) => farm.id)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
  }, [farmsQuery.data]);

  const farmNames = useMemo(
    () => farms.map((farm) => farm.name).filter(Boolean),
    [farms],
  );

  return {
    ...query,
    isLoading: query.isLoading || farmsQuery.isLoading,
    workplaces: query.data ?? [],
    farms,
    farmNames,
  };
}
