import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const farmerRequestKeys = {
  all: ["farmer-requests"],
  byDate: (date) => [...farmerRequestKeys.all, date],
};

export function useFarmerRequestsByDate(date, options = {}) {
  return useQuery({
    queryKey: farmerRequestKeys.byDate(date),
    queryFn: () => base44.entities.FarmerRequest.filter({ date }),
    enabled: !!date,
    ...options,
  });
}
