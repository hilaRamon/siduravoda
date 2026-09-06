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

const BASE = "/api/published-schedules";

export const publishedScheduleApi = {
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

  upsert(data) {
    return apiRequest(BASE, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  update(id, data) {
    return apiRequest(`${BASE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  remove(id) {
    return apiRequest(`${BASE}/${id}`, {
      method: "DELETE",
    });
  },

  getPublic() {
    return apiRequest("/api/public/schedule", { cache: "no-store" });
  },
};
