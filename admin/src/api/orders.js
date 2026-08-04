import { api } from "../api.js";

export async function getOrders({
  status,
  from,
  to,
  page = 1,
  limit = 10,
  search,
} = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return api(`/admin/orders?${params.toString()}`);
}

export function getOrder(id) {
  return api(`/admin/orders/${id}`);
}

export function updateOrderStatus(id, status) {
  return api(`/admin/orders/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
}