import { api } from "../api.js";

export function getCoupons() {
  return api("/admin/coupons");
}

export function createCoupon(data) {
  return api("/admin/coupons", { method: "POST", body: data });
}

export function updateCoupon(id, data) {
  return api(`/admin/coupons/${id}`, { method: "PUT", body: data });
}

export function deleteCoupon(id) {
  return api(`/admin/coupons/${id}`, { method: "DELETE" });
}