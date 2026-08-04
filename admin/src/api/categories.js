import { api } from "../api.js";

export function getCategories() {
  return api("/categories");
}

export function createCategory(formData) {
  return api("/admin/categories", { method: "POST", body: formData });
}

export function updateCategory(id, formData) {
  return api(`/admin/categories/${id}`, { method: "PUT", body: formData });
}

export function deleteCategory(id) {
  return api(`/admin/categories/${id}`, { method: "DELETE" });
}