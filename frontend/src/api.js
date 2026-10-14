// All requests use a single backend origin. Only public VITE_* variables go in frontend/.env.
export const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function request(path, options = {}) {
  const response = await fetch(`${API}/api${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

export const post = (path, body) =>
  request(path, { method: "POST", body: JSON.stringify(body) });
export const patch = (path, body) =>
  request(path, { method: "PATCH", body: JSON.stringify(body) });
