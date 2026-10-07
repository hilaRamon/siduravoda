import { useMemo } from "react";
import { useFarmerRequestsByDate } from "@/queries/farmerRequestQueries";

export function useLogisticsWorkplaces(date, assignments = []) {
  const { data: farmerRequests = [] } = useFarmerRequestsByDate(date);

  const requestByWorkplace = useMemo(() => {
    const map = {};
    farmerRequests.forEach((r) => {
      if (!r.workplace_id) return;
      if (!map[r.workplace_id]) {
        map[r.workplace_id] = {
          name: r.workplace_name || "",
          requested: null,
        };
      }
      if (r.workplace_name) map[r.workplace_id].name = r.workplace_name;
      if (r.requested_volunteers != null) {
        map[r.workplace_id].requested =
          (map[r.workplace_id].requested ?? 0) + r.requested_volunteers;
      }
    });
    return map;
  }, [farmerRequests]);

  const workplaces = useMemo(() => {
    const map = {};
    assignments
      .filter((a) => a.workplace_id && a.workplace_name)
      .forEach((a) => {
        if (!map[a.workplace_id]) {
          map[a.workplace_id] = { name: a.workplace_name, students: new Set() };
        }
        map[a.workplace_id].students.add(a.student_id);
      });

    Object.entries(requestByWorkplace).forEach(([id, req]) => {
      if (!map[id]) {
        map[id] = { name: req.name, students: new Set() };
      } else if (req.name && !map[id].name) {
        map[id].name = req.name;
      }
    });

    return Object.entries(map)
      .filter(([id, v]) => v.students.size > 0 || requestByWorkplace[id])
      .sort(([, a], [, b]) => a.name.localeCompare(b.name, "he"))
      .map(([id, v]) => ({
        id,
        name: v.name,
        count: v.students.size,
        requestedVolunteers: requestByWorkplace[id]?.requested ?? null,
      }));
  }, [assignments, requestByWorkplace]);

  return { workplaces };
}
