/** @typedef {Error & { status?: number, data?: unknown }} ApiError */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const TOKEN_KEY = "auth_token";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

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
      return apiRequest(
        `/api/entities/${entityName}${buildQuery({ sort, limit })}`,
      );
    },
    filter(filter = {}, sort, limit = 1000) {
      return apiRequest(`/api/entities/${entityName}/filter`, {
        method: "POST",
        body: JSON.stringify({ filter, sort, limit }),
      });
    },
    create(data) {
      return apiRequest(`/api/entities/${entityName}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    bulkCreate(items) {
      return apiRequest(`/api/entities/${entityName}/bulk`, {
        method: "POST",
        body: JSON.stringify(items),
      });
    },
    update(id, data) {
      return apiRequest(`/api/entities/${entityName}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    delete(id) {
      return apiRequest(`/api/entities/${entityName}/${id}`, {
        method: "DELETE",
      });
    },
  };
}

async function uploadFile({ file }) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest("/api/integrations/core/upload-file", {
    method: "POST",
    body: formData,
  });
}

async function htmlToPdf({ html }) {
  const headers = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/integrations/core/html-to-pdf`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ html }),
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      // response had no JSON body
    }
    /** @type {ApiError} */
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.blob();
}

function joinList(values) {
  if (!values?.length) return undefined;
  return values.join(",");
}

export const base44 = {
  public: {
    getPublishedSchedule() {
      return apiRequest("/api/public/schedule", { cache: "no-store" });
    },
  },
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
    TimeReport: createEntityClient("TimeReport"),
    AppSettings: createEntityClient("AppSettings"),
  },
  integrations: {
    Core: {
      UploadFile: uploadFile,
      HtmlToPdf: htmlToPdf,
    },
  },
  reports: {
    workByWorkplace({ startDate, endDate, workplaces, farms, groupBy }) {
      return apiRequest(
        `/api/reports/work-by-workplace${buildQuery({
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
        `/api/reports/student-work${buildQuery({
          startDate,
          endDate,
          students: joinList(students),
        })}`,
      );
    },
    arzenu({ startDate, endDate }) {
      return apiRequest(
        `/api/reports/arzenu${buildQuery({ startDate, endDate })}`,
      );
    },
  },
  auth: {
    async login(email, password, rememberMe = false) {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      });
      setAuthToken(result.token);
      return result.user;
    },
    async autoLogin(email) {
      const result = await apiRequest("/api/auth/auto-login", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setAuthToken(result.token);
      return result.user;
    },
    listLoginEmails() {
      return apiRequest("/api/auth/login-emails");
    },
    async logout() {
      try {
        await apiRequest("/api/auth/logout", { method: "POST" });
      } finally {
        setAuthToken(null);
      }
    },
    me() {
      return apiRequest("/api/auth/me");
    },
    listUsers() {
      return apiRequest("/api/auth/users");
    },
    inviteUser(email, level = "user", fullName = "") {
      return apiRequest("/api/auth/invite", {
        method: "POST",
        body: JSON.stringify({ email, level, full_name: fullName }),
      });
    },
    updateUser(id, data) {
      return apiRequest(`/api/auth/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    deleteUser(id) {
      return apiRequest(`/api/auth/users/${id}`, { method: "DELETE" });
    },
    setUserPassword(userId, password) {
      return apiRequest(`/api/auth/users/${userId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      });
    },
    updateMe(data) {
      return apiRequest("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    changePassword(currentPassword, newPassword) {
      return apiRequest("/api/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
    },
  },
  admin: {
    runBackup() {
      return apiRequest("/api/admin/backup/run", { method: "POST" });
    },
    sendBackupVerification(emails) {
      return apiRequest("/api/admin/backup/verify", {
        method: "POST",
        body: JSON.stringify({ emails }),
      });
    },
  },
};
