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

const BASE = "/api/absence-requests";

export const absenceApi = {
  list(filters = {}) {
    return apiRequest(`${BASE}${buildQuery(filters)}`);
  },

  getById(id) {
    return apiRequest(`${BASE}/${id}`);
  },

  createManual({ date, student_id, reason, notes }) {
    return apiRequest(BASE, {
      method: "POST",
      body: JSON.stringify({ date, student_id, reason, notes }),
    });
  },

  update(id, data) {
    return apiRequest(`${BASE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  approve(id, body = {}) {
    return apiRequest(`${BASE}/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  reject(id) {
    return apiRequest(`${BASE}/${id}/reject`, {
      method: "POST",
    });
  },

  remove(id) {
    return apiRequest(`${BASE}/${id}`, {
      method: "DELETE",
    });
  },
};
