/** @typedef {Error & { status?: number, data?: unknown }} ApiError */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    /** @type {ApiError} */
    const error = new Error(
      payload?.message || `Request failed: ${response.status}`,
    );
    error.status = response.status;
    error.data = payload;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function buildQuery(params) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

function createEntityClient(entityName) {
  return {
    list(sort, limit = 1000) {
      return request(
        `/api/entities/${entityName}${buildQuery({ sort, limit })}`,
      );
    },
    filter(filter = {}, sort, limit = 1000) {
      return request(`/api/entities/${entityName}/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter, sort, limit }),
      });
    },
    create(data) {
      return request(`/api/entities/${entityName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    bulkCreate(items) {
      return request(`/api/entities/${entityName}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
    },
    update(id, data) {
      return request(`/api/entities/${entityName}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    delete(id) {
      return request(`/api/entities/${entityName}/${id}`, {
        method: "DELETE",
      });
    },
  };
}

async function uploadFile({ file }) {
  const formData = new FormData();
  formData.append("file", file);

  return request("/api/integrations/core/upload-file", {
    method: "POST",
    body: formData,
  });
}

export const base44 = {
  entities: {
    User: createEntityClient("User"),
    Student: createEntityClient("Student"),
    Assignment: createEntityClient("Assignment"),
    Vehicle: createEntityClient("Vehicle"),
    Role: createEntityClient("Role"),
    Workplace: createEntityClient("Workplace"),
    WorkplaceLogistics: createEntityClient("WorkplaceLogistics"),
    PublishedSchedule: createEntityClient("PublishedSchedule"),
    BackupSettings: createEntityClient("BackupSettings"),
    IncomingSMS: createEntityClient("IncomingSMS"),
    FarmerRequest: createEntityClient("FarmerRequest"),
  },
  integrations: {
    Core: {
      UploadFile: uploadFile,
    },
  },
  auth: {
    me() {
      return request("/api/auth/me");
    },
    logout() {},
    redirectToLogin() {},
  },
};
