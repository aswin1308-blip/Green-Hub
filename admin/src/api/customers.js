import { api } from "../api.js";

export async function getCustomers({ search, page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return api(`/admin/customers?${params.toString()}`);
}

export function getCustomerOrders(customerId, { page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return api(`/admin/orders?${params.toString()}`);
}

export function toggleCustomerBlock(id, blocked) {
  return api(`/admin/customers/${id}`, {
    method: "PATCH",
    body: { blocked },
  });
}