import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmerRequestApi } from "@/api/farmerRequestApi";

export const farmerRequestKeys = {
  all: ["farmer-requests"],
  list: (filters = {}) => [...farmerRequestKeys.all, "list", filters],
  byDate: (date) => [...farmerRequestKeys.all, "byDate", date],
};

function invalidateFarmerRequestQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: farmerRequestKeys.all });
}

export function useFarmerRequests(filters = {}, options = {}) {
  return useQuery({
    queryKey: farmerRequestKeys.list(filters),
    queryFn: () => farmerRequestApi.list(filters),
    ...options,
  });
}

export function useFarmerRequestsByDate(date, options = {}) {
  return useQuery({
    queryKey: farmerRequestKeys.byDate(date),
    queryFn: () => farmerRequestApi.list({ date }),
    enabled: !!date,
    ...options,
  });
}

/**
 * @typedef {{ date: string, workplace_id: string, workplace_name?: string, requested_volunteers?: number|null }} FarmerRequestInput
 */

export function useCreateFarmerRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    /** @param {FarmerRequestInput} data */
    mutationFn: (data) => farmerRequestApi.create(data),
    onSuccess: () => invalidateFarmerRequestQueries(queryClient),
  });
}

export function useDeleteFarmerRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => farmerRequestApi.remove(id),
    onSuccess: () => invalidateFarmerRequestQueries(queryClient),
  });
}
