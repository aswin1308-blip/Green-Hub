import { api } from "../api.js";

export async function getProducts({ category, search, page = 1, limit = 10, status } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return api(`/products?${params.toString()}`);
}

export function createProduct(formData) {
  return api("/admin/products", { method: "POST", body: formData });
}

export function updateProduct(id, formData) {
  return api(`/admin/products/${id}`, { method: "PUT", body: formData });
}

export function deleteProduct(id) {
  return api(`/admin/products/${id}`, { method: "DELETE" });
}

export function updateStock(id, stock) {
  return api(`/admin/products/${id}/stock`, {
    method: "PATCH",
    body: { stock },
  });
}