import { useCallback, useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { useToast } from "../ui/useToast.js";
import { assetUrl } from "../api.js";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../api/categories.js";
import "./Categories.css";

export default function Categories() {
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [showOnHomepage, setShowOnHomepage] = useState(true);
  const [showInNavDropdown, setShowInNavDropdown] = useState(false);
  const [navGroup, setNavGroup] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [existingImage, setExistingImage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCategories();
      setCategories(res.categories || []);
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
    setName("");
    setSlug("");
    setDescription("");
    setShowOnHomepage(true);
    setShowInNavDropdown(false);
    setNavGroup("");
    setImageFile(null);
    setExistingImage("");
    setFormOpen(true);
  };

  const openEdit = (category) => {
    setFormError("");
    setEditing(category);
    setName(category.name || "");
    setSlug(category.slug || "");
    setDescription(category.description || "");
    setShowOnHomepage(category.showOnHomepage !== false);
    setShowInNavDropdown(category.showInNavDropdown === true);
    setNavGroup(category.navGroup || "");
    setImageFile(null);
    setExistingImage(category.image || "");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setEditing(null);
    setFormError("");
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
    fd.append("name", name.trim());
    if (slug.trim()) fd.append("slug", slug.trim());
    fd.append("description", description.trim());
    fd.append("showOnHomepage", String(showOnHomepage));
    fd.append("showInNavDropdown", String(showInNavDropdown));
    fd.append("navGroup", showInNavDropdown ? navGroup : "");
    if (imageFile) fd.append("image", imageFile, imageFile.name);

    setSubmitting(true);
    setFormError("");
    try {
      if (editing) {
        if (!imageFile && existingImage === "") {
          fd.append("image", "");
        }
        await updateCategory(editing._id, fd);
        toast.success("Category updated successfully");
      } else {
        await createCategory(fd);
        toast.success("Category added successfully");
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
      await deleteCategory(confirmDelete._id);
      toast.success("Category deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const formInvalid = name.trim().length < 2;

  return (
    <div className="categories-page">
      <div className="toolbar">
        <p className="muted categories-total">
          {categories.length} categor{ categories.length === 1 ? "y" : "ies"}
        </p>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          Add Category
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p className="muted">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="muted">No categories found.</p>
        ) : (
          <div className="category-grid">
            {categories.map((c) => (
              <div key={c._id} className="category-card">
                {c.image ? (
                  <img className="category-img" src={assetUrl(c.image)} alt={c.name} />
                ) : (
                  <div className="category-img category-img-empty">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="category-body">
                  <h3 className="category-name">{c.name}</h3>
                  <span className="category-slug muted">{c.slug}</span>
                  <div className="category-flags">
                    {c.showOnHomepage !== false && (
                      <span className="cat-flag">Home</span>
                    )}
                    {c.showInNavDropdown && (
                      <span className="cat-flag cat-flag-nav">
                        Nav · {c.navGroup || "Other"}
                      </span>
                    )}
                  </div>
                  <p className="category-desc">
                    {c.description || "No description"}
                  </p>
                </div>
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
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? "Edit Category" : "Add Category"}
        onClose={closeForm}
        width="560px"
      >
        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="cf-name">Name *</label>
              <input
                id="cf-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vegetable Seeds"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="cf-slug">Slug (optional)</label>
              <input
                id="cf-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto from name"
              />
            </div>

            <div className="field field-full">
              <label htmlFor="cf-desc">Description</label>
              <textarea
                id="cf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short category description"
                rows="3"
              />
            </div>

            <div className="field field-full">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showOnHomepage}
                  onChange={(e) => setShowOnHomepage(e.target.checked)}
                />
                Show on homepage (Shop by Category circles)
              </label>
            </div>

            <div className="field field-full">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showInNavDropdown}
                  onChange={(e) => setShowInNavDropdown(e.target.checked)}
                />
                Show in navbar dropdown
              </label>
            </div>

            <div className="field field-full">
              <label htmlFor="cf-navgroup">Nav menu group</label>
              <select
                id="cf-navgroup"
                value={navGroup}
                disabled={!showInNavDropdown}
                onChange={(e) => setNavGroup(e.target.value)}
              >
                <option value="">-- Select menu --</option>
                <option value="Plants">Plants</option>
                <option value="Pot Plants">Pot Plants</option>
                <option value="Bulbs & Seeds">Bulbs &amp; Seeds</option>
                <option value="Planters">Planters</option>
                <option value="Gardening Kit">Gardening Kit</option>
              </select>
            </div>

            <div className="field field-full">
              <label>Image</label>
              <div className="image-uploader">
                <label className="upload-btn">
                  {imageFile ? "Choose another" : "Upload image"}
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
                    src={imageFile ? URL.createObjectURL(imageFile) : assetUrl(existingImage)}
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
              {submitting ? "Saving..." : editing ? "Save Changes" : "Add Category"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title="Delete category"
        onClose={() => setConfirmDelete(null)}
        width="420px"
      >
        <p>
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
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