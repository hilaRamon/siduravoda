import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmApi } from "@/api/farmApi";

export const farmKeys = {
  all: ["farms"],
};

function invalidateFarmQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: farmKeys.all });
}

export function useFarms(options = {}) {
  return useQuery({
    queryKey: farmKeys.all,
    queryFn: () => farmApi.list(),
    ...options,
  });
}

export function useCreateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => farmApi.create(data),
    onSuccess: () => invalidateFarmQueries(queryClient),
  });
}

/**
 * @typedef {object} FarmUpdateInput
 * @property {string} id
 * @property {Record<string, unknown>} data
 */

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    /** @param {FarmUpdateInput} vars */
    mutationFn: (vars) => farmApi.update(vars.id, vars.data),
    onSuccess: () => invalidateFarmQueries(queryClient),
  });
}

export function useDeleteFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => farmApi.remove(id),
    onSuccess: () => invalidateFarmQueries(queryClient),
  });
}
