import { api } from "../api.js";

export function getNotifications(limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  return api(`/admin/notifications?${params.toString()}`);
}

export function markNotificationRead(id) {
  return api(`/admin/notifications/${id}/read`, {
    method: "PATCH",
    body: {},
  });
}
