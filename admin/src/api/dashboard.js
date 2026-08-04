import { api } from "../api.js";

export function getDashboardSummary(days = 30) {
  return api(`/admin/dashboard/summary?days=${days}`);
}