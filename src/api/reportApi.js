import { apiRequest } from "@/api/base44Client";

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

function joinList(values) {
  if (!values?.length) return undefined;
  return values.join(",");
}

const BASE = "/api/reports";

export const reportApi = {
  workByWorkplace({ startDate, endDate, workplaces, farms, groupBy }) {
    return apiRequest(
      `${BASE}/work-by-workplace${buildQuery({
        startDate,
        endDate,
        workplaces: joinList(workplaces),
        farms: joinList(farms),
        groupBy,
      })}`,
    );
  },

  studentWork({ startDate, endDate, students }) {
    return apiRequest(
      `${BASE}/student-work${buildQuery({
        startDate,
        endDate,
        students: joinList(students),
      })}`,
    );
  },

  arzenu({ startDate, endDate }) {
    return apiRequest(
      `${BASE}/arzenu${buildQuery({ startDate, endDate })}`,
    );
  },
};
