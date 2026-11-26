import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transportationSummaryApi } from "@/api/transportationSummaryApi";

export const transportationSummaryKeys = {
  all: ["transportation-summaries"],
  byDate: (date) => [...transportationSummaryKeys.all, date],
};

export function useTransportationSummaries(date) {
  return useQuery({
    queryKey: transportationSummaryKeys.byDate(date),
    queryFn: () => transportationSummaryApi.list({ date }),
    enabled: !!date,
  });
}

export function useCreateTransportationSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => transportationSummaryApi.create(data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: transportationSummaryKeys.byDate(variables?.date),
      });
    },
  });
}

export function useUpdateTransportationSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => transportationSummaryApi.update(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: transportationSummaryKeys.byDate(variables?.date),
      });
    },
  });
}
