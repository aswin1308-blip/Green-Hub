const API_URL = (import.meta.env.VITE_API_URL || "https://greenhub1.onrender.com/api").replace(/\/$/, "");
const ASSET_URL = (import.meta.env.VITE_ASSET_URL || "https://greenhub1.onrender.com").replace(/\/$/, "");

export function getToken() {
  return localStorage.getItem("gh_admin_token");
}

export function assetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${ASSET_URL}${path}`;
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = "GET", body, headers = {} } = {}) {
  const options = { method, headers: { ...headers } };

  const token = getToken();
  if (token) options.headers.Authorization = `Bearer ${token}`;

  if (body !== undefined) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new ApiError("Unable to reach the server", 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const message = data?.message || `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  return data;
}