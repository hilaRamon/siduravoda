import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const roleKeys = {
  all: ["roles"],
};

export function useRoles(options = {}) {
  return useQuery({
    queryKey: roleKeys.all,
    queryFn: () => base44.entities.Role.list(),
    ...options,
  });
}
