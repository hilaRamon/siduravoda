import { apiRequest } from "@/api/base44Client";

const BASE = "/api/permission-rules";

export const permissionRuleApi = {
  list() {
    return apiRequest(BASE);
  },

  getById(id) {
    return apiRequest(`${BASE}/${id}`);
  },

  getByRole(role) {
    return apiRequest(`${BASE}/by-role/${encodeURIComponent(role)}`);
  },

  update(id, data) {
    return apiRequest(`${BASE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};
