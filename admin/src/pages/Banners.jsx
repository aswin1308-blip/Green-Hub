import { useCallback, useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { useToast } from "../ui/useToast.js";
import { assetUrl } from "../api.js";
import {
  createBanner,
  deleteBanner,
  getBanners,
  reorderBanners,
  updateBanner,
} from "../api/banners.js";
import "./Banners.css";

const EMPTY_FORM = {
  order: "",
  isActive: true,
};

export default function Banners() {
  const toast = useToast();

  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [existingImage, setExistingImage] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [reordering, setReordering] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBanners();
      const list = (res.banners || [])
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setBanners(list);
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
    setImageFile(null);
    setExistingImage("");
    setFormOpen(true);
  };

  const openEdit = (banner) => {
    setFormError("");
    setEditing(banner);
    setForm({
      order: banner.order != null ? String(banner.order) : "",
      isActive: banner.isActive != null ? banner.isActive : true,
    });
    setImageFile(null);
    setExistingImage(banner.imageUrl || "");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setEditing(null);
    setFormError("");
  };

  const updateField = (e, key) => {
    const value = key === "isActive" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onFileSelected = (e) => {
    setImageFile(e.target.files?.[0] || null);
    e.target.value = "";
  };

  const removeExistingImage = () => {
    setExistingImage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const fd = new FormData();
    if (form.order !== "") fd.append("order", String(form.order));
    fd.append("isActive", String(form.isActive));
    if (imageFile) fd.append("image", imageFile, imageFile.name);

    setSubmitting(true);
    setFormError("");
    try {
      if (editing) {
        if (!imageFile && existingImage === "") {
          fd.append("image", "");
        }
        await updateBanner(editing._id, fd);
        toast.success("Banner updated successfully");
      } else {
        await createBanner(fd);
        toast.success("Banner added successfully");
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
      await deleteBanner(confirmDelete._id);
      toast.success("Banner deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (banner) => {
    setTogglingId(banner._id);
    try {
      await updateBanner(banner._id, { isActive: !banner.isActive });
      toast.success(banner.isActive ? "Banner deactivated" : "Banner activated");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= banners.length) return;

    const next = banners.slice();
    const item = next.splice(index, 1)[0];
    next.splice(target, 0, item);

    setReordering(true);
    try {
      await reorderBanners(next.map((b) => b._id));
      setBanners(next.map((b, i) => ({ ...b, order: i + 1 })));
      toast.success("Banner order updated");
    } catch (err) {
      toast.error(err.message);
      load();
    } finally {
      setReordering(false);
    }
  };

  const formInvalid = editing ? !imageFile && !existingImage : !imageFile;

  return (
    <div className="banners-page">
      <div className="toolbar">
        <p className="muted banners-total">
          {banners.length} banner{banners.length === 1 ? "" : "s"}
        </p>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          Add Banner
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p className="muted">Loading banners...</p>
        ) : banners.length === 0 ? (
          <p className="muted">
            No banners found. Add your first homepage banner to start the
            carousel.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((b, i) => (
                  <tr key={b._id}>
                    <td>
                      {b.imageUrl ? (
                        <img
                          className="banner-thumb"
                          src={assetUrl(b.imageUrl)}
                          alt=""
                        />
                      ) : (
                        <span className="banner-thumb banner-thumb-empty">
                          --
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="order-arrows">
                        <span className="banner-order">#{b.order}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={reordering || i === 0}
                          onClick={() => move(i, -1)}
                          aria-label="Move banner up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={reordering || i === banners.length - 1}
                          onClick={() => move(i, 1)}
                          aria-label="Move banner down"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="toggle-cell">
                        <button
                          type="button"
                          className={`toggle ${b.isActive ? "toggle-on" : ""}`}
                          role="switch"
                          aria-checked={b.isActive}
                          disabled={togglingId === b._id}
                          onClick={() => handleToggle(b)}
                          aria-label={b.isActive ? "Deactivate banner" : "Activate banner"}
                        >
                          <span className="toggle-knob" />
                        </button>
                        <span
                          className={`badge ${b.isActive ? "badge-active" : "badge-inactive"}`}
                        >
                          {b.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(b)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setConfirmDelete(b)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? "Edit Banner" : "Add Banner"}
        onClose={closeForm}
        width="640px"
      >
        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-grid">
            <div className="field field-full">
              <label>Banner image{editing ? "" : " *"}</label>
              <div className="image-uploader">
                <label className="upload-btn">
                  {imageFile ? "Choose another" : editing && existingImage ? "Replace image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onFileSelected}
                  />
                </label>
                <span className="muted hint">
                  {imageFile
                    ? imageFile.name
                    : existingImage
                      ? "Keep current image"
                      : "JPEG, PNG, WebP or GIF (up to 5MB)"}
                </span>
              </div>

              {(imageFile || existingImage) && (
                <div className="category-preview">
                  <img
                    src={
                      imageFile
                        ? URL.createObjectURL(imageFile)
                        : assetUrl(existingImage)
                    }
                    alt=""
                  />
                  <button
                    type="button"
                    className="remove-image"
                    onClick={() =>
                      imageFile ? setImageFile(null) : removeExistingImage()
                    }
                    aria-label="Remove image"
                  >
                    x
                  </button>
                </div>
              )}
            </div>

            <div className="field field-full">
              <label htmlFor="bn-order">Order (optional)</label>
              <input
                id="bn-order"
                type="number"
                min="0"
                step="1"
                value={form.order}
                onChange={(e) => updateField(e, "order")}
                placeholder="auto at end"
              />
            </div>

            <div className="field field-full">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateField(e, "isActive")}
                />
                Active (shown in the homepage carousel)
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
              {submitting ? "Saving..." : editing ? "Save Changes" : "Add Banner"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title="Delete banner"
        onClose={() => setConfirmDelete(null)}
        width="420px"
      >
        <p>
          Are you sure you want to delete this banner? This action cannot be
          undone.
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
