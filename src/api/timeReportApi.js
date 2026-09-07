import { apiRequest } from "@/api/base44Client";

const BASE = "/api/time-reports";

export const timeReportApi = {
  bulkStatus({ ids, status }) {
    return apiRequest(`${BASE}/bulk-status`, {
      method: "POST",
      body: JSON.stringify({ ids, status }),
    });
  },

  approveDate(date) {
    return apiRequest(`${BASE}/approve-date`, {
      method: "POST",
      body: JSON.stringify({ date }),
    });
  },
};
