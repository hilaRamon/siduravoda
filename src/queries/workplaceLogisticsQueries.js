import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workplaceLogisticsApi } from "@/api/workplaceLogisticsApi";

export const workplaceLogisticsKeys = {
  all: ["workplace-logistics"],
  byDate: (date) => [...workplaceLogisticsKeys.all, date],
};

function invalidateWorkplaceLogisticsQueries(queryClient, date) {
  if (date) {
    queryClient.invalidateQueries({ queryKey: workplaceLogisticsKeys.byDate(date) });
    queryClient.invalidateQueries({ queryKey: ["assignments", date] });
  } else {
    queryClient.invalidateQueries({ queryKey: workplaceLogisticsKeys.all });
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  }
}

export function useWorkplaceLogisticsByDate(date, options = {}) {
  return useQuery({
    queryKey: workplaceLogisticsKeys.byDate(date),
    queryFn: () => workplaceLogisticsApi.list({ date }),
    enabled: !!date,
    ...options,
  });
}

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, any>}
 */
export function useCreateWorkplaceLogistics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => workplaceLogisticsApi.create(data),
    onSuccess: (_result, variables) => {
      invalidateWorkplaceLogisticsQueries(queryClient, variables?.date);
    },
  });
}

/**
 * @typedef {object} WorkplaceLogisticsUpdateInput
 * @property {string} id
 * @property {Record<string, unknown>} data
 * @property {string} [date]
 */

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, WorkplaceLogisticsUpdateInput>}
 */
export function useUpdateWorkplaceLogistics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {WorkplaceLogisticsUpdateInput} */ vars) =>
      workplaceLogisticsApi.update(vars.id, vars.data),
    onSuccess: (_result, variables) => {
      invalidateWorkplaceLogisticsQueries(queryClient, variables?.date);
    },
  });
}
