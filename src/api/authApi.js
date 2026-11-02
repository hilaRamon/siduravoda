import { apiRequest, setAuthToken } from "@/api/base44Client";

export const authApi = {
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

  async loginWithGoogle(credential, rememberMe = false) {
    const result = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, rememberMe }),
    });
    setAuthToken(result.token);
    return result.user;
  },

  async rememberedSession() {
    const result = await apiRequest("/api/auth/remembered-session", {
      method: "POST",
      body: JSON.stringify({}),
    });
    setAuthToken(result.token);
    return result.user;
  },

  googleClientId() {
    return apiRequest("/api/auth/google-client-id");
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
};
