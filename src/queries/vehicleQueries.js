import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vehicleApi } from "@/api/vehicleApi";

export const vehicleKeys = {
  all: ["vehicles"],
};

function invalidateVehicleQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
}

export function useVehicles(options = {}) {
  return useQuery({
    queryKey: vehicleKeys.all,
    queryFn: () => vehicleApi.list(),
    ...options,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => vehicleApi.create(data),
    onSuccess: () => invalidateVehicleQueries(queryClient),
  });
}

/**
 * @typedef {object} VehicleUpdateInput
 * @property {string} id
 * @property {Record<string, unknown>} data
 */

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    /** @param {VehicleUpdateInput} vars */
    mutationFn: (vars) => vehicleApi.update(vars.id, vars.data),
    onSuccess: () => invalidateVehicleQueries(queryClient),
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => vehicleApi.remove(id),
    onSuccess: () => invalidateVehicleQueries(queryClient),
  });
}
