import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const assignmentKeys = {
  all: ["assignments"],
  byDate: (date) => [...assignmentKeys.all, date],
};

export function useAssignments(date, options = {}) {
  return useQuery({
    queryKey: assignmentKeys.byDate(date),
    queryFn: () =>
      base44.entities.Assignment.filter({ date }, "-created_date", 2000),
    ...options,
  });
}
