import { useCallback, useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { useToast } from "../ui/useToast.js";
import {
  createCoupon,
  deleteCoupon,
  getCoupons,
  updateCoupon,
} from "../api/coupons.js";
import "./Coupons.css";

const EMPTY_FORM = {
  code: "",
  discountType: "percentage",
  value: "",
  minOrderValue: "",
  expiryDate: "",
  usageLimit: "",
  isActive: true,
};

const formatDate = (iso) => {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString();
};

const discountLabel = (c) =>
  c.discountType === "percentage" ? `${c.value}%` : `Rs.${c.value}`;

export default function Coupons() {
  const toast = useToast();

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCoupons();
      setCoupons(res.coupons || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setFormError("");
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (coupon) => {
    setFormError("");
    setEditing(coupon);
    setForm({
      code: coupon.code || "",
      discountType: coupon.discountType || "percentage",
      value: coupon.value != null ? String(coupon.value) : "",
      minOrderValue:
        coupon.minOrderValue != null ? String(coupon.minOrderValue) : "",
      expiryDate: coupon.expiryDate
        ? coupon.expiryDate.slice(0, 10)
        : "",
      usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : "",
      isActive: coupon.isActive != null ? coupon.isActive : true,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setEditing(null);
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      code: form.code.trim(),
      discountType: form.discountType,
      value: Number(form.value),
      minOrderValue: form.minOrderValue === "" ? 0 : Number(form.minOrderValue),
      expiryDate: form.expiryDate || undefined,
      usageLimit: form.usageLimit === "" ? 0 : Number(form.usageLimit),
      isActive: form.isActive,
    };

    setSubmitting(true);
    setFormError("");
    try {
      if (editing) {
        await updateCoupon(editing._id, payload);
        toast.success("Coupon updated successfully");
      } else {
        await createCoupon(payload);
        toast.success("Coupon added successfully");
      }
      setFormOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCoupon(confirmDelete._id);
      toast.success("Coupon deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const numValue = Number(form.value);
  const formInvalid =
    form.code.trim().length < 3 ||
    Number.isNaN(numValue) ||
    numValue <= 0 ||
    (form.discountType === "percentage" && numValue > 100) ||
    (form.minOrderValue !== "" && Number(form.minOrderValue) < 0) ||
    (form.usageLimit !== "" && Number(form.usageLimit) < 0);

  const updateField = (e, key) => {
    const value = key === "isActive" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="coupons-page">
      <div className="toolbar">
        <p className="muted coupons-total">
          {coupons.length} coupon{ coupons.length === 1 ? "" : "s"}
        </p>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          Add Coupon
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p className="muted">Loading coupons...</p>
        ) : coupons.length === 0 ? (
          <p className="muted">No coupons found.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min order</th>
                  <th>Expires</th>
                  <th>Usage limit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const expired =
                    c.expiryDate && new Date(c.expiryDate) < new Date();
                  return (
                    <tr key={c._id}>
                      <td className="coupon-code">{c.code}</td>
                      <td>{discountLabel(c)}</td>
                      <td>{c.minOrderValue > 0 ? `Rs.${c.minOrderValue}` : "--"}</td>
                      <td>
                        {formatDate(c.expiryDate)}{" "}
                        {expired && <span className="expired-tag">expired</span>}
                      </td>
                      <td>{c.usageLimit > 0 ? c.usageLimit : "Unlimited"}</td>
                      <td>
                        {c.isActive && !expired ? (
                          <span className="badge badge-active">Active</span>
                        ) : (
                          <span className="badge badge-inactive">Inactive</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirmDelete(c)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? "Edit Coupon" : "Add Coupon"}
        onClose={closeForm}
        width="560px"
      >
        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="cp-code">Code *</label>
              <input
                id="cp-code"
                type="text"
                value={form.code}
                onChange={(e) => updateField(e, "code")}
                placeholder="e.g. SAVE10"
                maxLength={30}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="cp-type">Discount type *</label>
              <select
                id="cp-type"
                value={form.discountType}
                onChange={(e) => updateField(e, "discountType")}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat (Rs.)</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="cp-value">Value *</label>
              <input
                id="cp-value"
                type="number"
                min="0"
                max={form.discountType === "percentage" ? 100 : undefined}
                step="0.01"
                value={form.value}
                onChange={(e) => updateField(e, "value")}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="cp-min">Minimum order value</label>
              <input
                id="cp-min"
                type="number"
                min="0"
                step="0.01"
                value={form.minOrderValue}
                onChange={(e) => updateField(e, "minOrderValue")}
              />
            </div>

            <div className="field">
              <label htmlFor="cp-expiry">Expiry date</label>
              <input
                id="cp-expiry"
                type="date"
                value={form.expiryDate}
                onChange={(e) => updateField(e, "expiryDate")}
              />
            </div>

            <div className="field">
              <label htmlFor="cp-limit">Usage limit</label>
              <input
                id="cp-limit"
                type="number"
                min="0"
                step="1"
                value={form.usageLimit}
                onChange={(e) => updateField(e, "usageLimit")}
              />
            </div>

            <div className="field field-full">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateField(e, "isActive")}
                />
                Active
              </label>
            </div>
          </div>

          {formError && <div className="alert error">{formError}</div>}

          <div className="modal-footer">
            <button type="button" className="btn" onClick={closeForm}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={formInvalid || submitting}
            >
              {submitting ? "Saving..." : editing ? "Save Changes" : "Add Coupon"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title="Delete coupon"
        onClose={() => setConfirmDelete(null)}
        width="420px"
      >
        <p>
          Are you sure you want to delete coupon <strong>{confirmDelete?.code}</strong>?
          This action cannot be undone.
        </p>
        <div className="modal-footer">
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmDelete(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}