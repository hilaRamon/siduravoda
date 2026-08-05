import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const workplaceKeys = {
  all: ["workplaces"],
};

export function useWorkplaces(options = {}) {
  return useQuery({
    queryKey: workplaceKeys.all,
    queryFn: () => base44.entities.Workplace.list("name", 1000),
    select: (data) =>
      [...data].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "he"),
      ),
    ...options,
  });
}
