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

const BASE = "/api/time-reports";

export const timeReportApi = {
  list(filters = {}) {
    return apiRequest(`${BASE}${buildQuery(filters)}`);
  },

  getById(id) {
    return apiRequest(`${BASE}/${id}`);
  },

  create(data) {
    return apiRequest(BASE, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(id, data) {
    return apiRequest(`${BASE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

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
