// src/components/Api.jsx
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const REFRESH_URL = `${API_BASE_URL}${import.meta.env.VITE_API_REFRESH_PATH}`;
const LOGIN_URL = import.meta.env.VITE_LOGIN_URL || "/login";

const api = axios.create({
  baseURL: API_BASE_URL,
  // Render's free tier can take a while to wake up after idling,
  // so give requests plenty of time before failing.
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Helpers ───────────────────────────────────────────────
function _clearSession() {
  ["accessToken", "refreshToken", "user", "isAuthenticated"].forEach((key) =>
    localStorage.removeItem(key)
  );
}

function _redirectToLogin() {
  _clearSession();
  // Avoid a redirect loop if we're already on the login page
  if (window.location.pathname !== LOGIN_URL) {
    window.location.href = LOGIN_URL;
  }
}

// ── Single shared refresh call ────────────────────────────
// If several requests get a 401 at the same time (e.g. a dashboard
// firing 5 calls at once), they all wait on ONE refresh request instead
// of each sending their own. This matters if your backend rotates/blacklists
// refresh tokens: a second parallel refresh would fail and log the user out.
let refreshPromise = null;

function _refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem("refreshToken");

    // Use plain axios (not `api`) so this call skips our interceptors
    refreshPromise = axios
      .post(
        REFRESH_URL,
        { refresh: refreshToken },
        { headers: { "Content-Type": "application/json" } }
      )
      .then(({ data }) => {
        // Handles both flat { access, refresh } and wrapped { data: { ... } }
        const payload = data?.data ?? data;
        const newAccessToken = payload.access;
        const newRefreshToken = payload.refresh;

        if (!newAccessToken) {
          throw new Error("Refresh response did not contain an access token");
        }

        localStorage.setItem("accessToken", newAccessToken);
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
        }
        return newAccessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// ── Request interceptor: attach access token + handle file uploads ──
api.interceptors.request.use(
  (config) => {
    if (!config.skipAuth) {
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    // FILE UPLOADS: when the body is FormData, remove the default
    // "application/json" Content-Type. Otherwise axios turns the FormData
    // into JSON (the file is lost) and Django answers 415 Unsupported Media Type.
    // With the header removed, the browser sets
    // "multipart/form-data; boundary=..." by itself, which is what Django needs.
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.headers && typeof config.headers.delete === "function") {
        config.headers.delete("Content-Type"); // axios 1.x (AxiosHeaders)
      } else if (config.headers) {
        delete config.headers["Content-Type"]; // older axios
        delete config.headers["content-type"];
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: auto-refresh on 401 ─────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // No config means a network/setup error, nothing to retry
    if (!originalRequest) return Promise.reject(error);

    // Requests marked skipAuth (login, signup, forgot password...) must
    // never trigger a refresh or redirect. A 401 there just means
    // "wrong credentials" and the page should show that error itself.
    if (originalRequest.skipAuth) return Promise.reject(error);

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!localStorage.getItem("refreshToken")) {
        _redirectToLogin();
        return Promise.reject(error);
      }

      try {
        const newAccessToken = await _refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        _redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;