import { api } from "../api.js";

export function getBanners() {
  return api("/admin/banners");
}

export function createBanner(formData) {
  return api("/admin/banners", { method: "POST", body: formData });
}

export function updateBanner(id, data) {
  return api(`/admin/banners/${id}`, { method: "PATCH", body: data });
}

export function deleteBanner(id) {
  return api(`/admin/banners/${id}`, { method: "DELETE" });
}

export function reorderBanners(ids) {
  return api("/admin/banners/reorder", { method: "PATCH", body: { ids } });
}
