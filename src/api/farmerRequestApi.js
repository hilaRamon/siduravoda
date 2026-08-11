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

const BASE = "/api/farmer-requests";

export const farmerRequestApi = {
  list(filters = {}) {
    return apiRequest(`${BASE}${buildQuery(filters)}`);
  },

  getById(id) {
    return apiRequest(`${BASE}/${id}`);
  },

  create({ date, workplace_id, workplace_name, requested_volunteers }) {
    return apiRequest(BASE, {
      method: "POST",
      body: JSON.stringify({
        date,
        workplace_id,
        workplace_name,
        requested_volunteers,
      }),
    });
  },

  remove(id) {
    return apiRequest(`${BASE}/${id}`, {
      method: "DELETE",
    });
  },
};
