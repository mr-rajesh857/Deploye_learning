const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function request(endpoint, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("zenith_token") : null;
  const activeUserId = typeof window !== "undefined" ? localStorage.getItem("zenith_user_id") : null;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeUserId ? { "X-User-Id": activeUserId } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth & Personas
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getDemoUsers: () => request("/auth/demo-users"),
  switchUser: (userId) => request(`/auth/switch-user/${userId}`, { method: "POST" }),
  getMe: () => request("/auth/me"),

  // Dashboard & Analytics
  getDashboardSummary: () => request("/analytics/dashboard-summary"),
  getCalendar: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/analytics/calendar${query ? `?${query}` : ""}`);
  },

  // Leaves
  getLeaveTypes: () => request("/leaves/types"),
  getBalances: (userId) => request(`/leaves/balances${userId ? `?user_id=${userId}` : ""}`),
  getRequests: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/leaves/${query ? `?${query}` : ""}`);
  },
  getRequestDetail: (id) => request(`/leaves/${id}`),
  createRequest: (data) => request("/leaves/", { method: "POST", body: JSON.stringify(data) }),
  approveRequest: (id, comment) =>
    request(`/leaves/${id}/approve${comment ? `?comment=${encodeURIComponent(comment)}` : ""}`, {
      method: "POST",
    }),
  rejectRequest: (id, comment) =>
    request(`/leaves/${id}/reject${comment ? `?comment=${encodeURIComponent(comment)}` : ""}`, {
      method: "POST",
    }),
  cancelRequest: (id, reason) =>
    request(`/leaves/${id}/cancel${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`, {
      method: "POST",
    }),

  // Users Directory
  getUsers: (department) =>
    request(`/users/${department ? `?department=${encodeURIComponent(department)}` : ""}`),
};
