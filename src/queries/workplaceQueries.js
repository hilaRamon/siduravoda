import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workplaceApi } from "@/api/workplaceApi";

export const workplaceKeys = {
  all: ["workplaces"],
};

export function useWorkplaces(options = {}) {
  return useQuery({
    queryKey: workplaceKeys.all,
    queryFn: () => workplaceApi.list({ sort: "name", limit: 1000 }),
    select: (data) =>
      [...data].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "he"),
      ),
    ...options,
  });
}

function invalidateWorkplaceQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: workplaceKeys.all });
}

export function useCreateWorkplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => workplaceApi.create(data),
    onSuccess: () => invalidateWorkplaceQueries(queryClient),
  });
}

/**
 * @typedef {object} WorkplaceUpdateInput
 * @property {string} id
 * @property {Record<string, unknown>} data
 */

export function useUpdateWorkplace() {
  const queryClient = useQueryClient();
  return useMutation({
    /** @param {WorkplaceUpdateInput} vars */
    mutationFn: (vars) => workplaceApi.update(vars.id, vars.data),
    onSuccess: () => invalidateWorkplaceQueries(queryClient),
  });
}

export function useDeleteWorkplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => workplaceApi.remove(id),
    onSuccess: () => invalidateWorkplaceQueries(queryClient),
  });
}
