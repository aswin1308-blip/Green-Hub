import { useEffect, useMemo, useState } from "react";
import { attributeFields } from "../constants/categoryAttributes.js";
import { assetUrl } from "../api.js";

function AttributeField({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <div className="field">
        <label htmlFor={`attr-${field.key}`}>{field.label}</label>
        <select
          id={`attr-${field.key}`}
          value={value || ""}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          <option value="">Select...</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={`attr-${field.key}`}>{field.label}</label>
      <input
        id={`attr-${field.key}`}
        type="text"
        value={value || ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    </div>
  );
}

export default function ProductFormModal({
  open,
  product,
  categories,
  onSubmit,
  onClose,
  submitting,
  error,
}) {
  const isEdit = Boolean(product);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [stock, setStock] = useState("");
  const [status, setStatus] = useState("active");
  const [attributes, setAttributes] = useState({});
  const [existingImages, setExistingImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  useEffect(() => {
    if (!open) return;

    if (product) {
      setName(product.name || "");
      setDescription(product.description || "");
      setCategoryId(product.category?._id || product.category || "");
      setPrice(product.price != null ? String(product.price) : "");
      setDiscountPrice(
        product.discountPrice != null ? String(product.discountPrice) : ""
      );
      setStock(product.stock != null ? String(product.stock) : "");
      setStatus(product.status || "active");
      setAttributes(product.attributes || {});
      setExistingImages(product.images || []);
    } else {
      setName("");
      setDescription("");
      setCategoryId(categories[0]?._id || "");
      setPrice("");
      setDiscountPrice("");
      setStock("");
      setStatus("active");
      setAttributes({});
      setExistingImages([]);
    }
    setNewFiles([]);
  }, [open, product, categories]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c._id === categoryId),
    [categories, categoryId]
  );

  const fields = useMemo(
    () => attributeFields(selectedCategory?.slug),
    [selectedCategory]
  );

  const updateAttribute = (key, value) => {
    setAttributes((prev) => {
      const next = { ...prev };
      if (value.trim() === "") delete next[key];
      else next[key] = value.trim();
      return next;
    });
  };

  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setNewFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeExistingImage = (img) => {
    setExistingImages((prev) => prev.filter((i) => i !== img));
  };

  const removeNewFile = (file) => {
    setNewFiles((prev) => prev.filter((f) => f !== file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name,
      description,
      category: categoryId,
      price,
      discountPrice,
      stock,
      status,
      attributes,
      keepImages: existingImages,
      newFiles,
    };

    await onSubmit(payload);
  };

  const numPrice = Number(price);
  const numDiscount = discountPrice === "" ? 0 : Number(discountPrice);
  const numStock = stock === "" ? 0 : Number(stock);
  const formInvalid =
    !name.trim() ||
    !description.trim() ||
    !categoryId ||
    Number.isNaN(numPrice) ||
    numPrice < 0 ||
    Number.isNaN(numStock) ||
    numStock < 0 ||
    (discountPrice !== "" && (Number.isNaN(numDiscount) || numDiscount < 0));

  return (
    <form
      onSubmit={handleSubmit}
      className="product-form"
      id="product-form"
    >
      <div className="form-grid">
        <div className="field field-wide">
          <label htmlFor="pf-name">Name *</label>
          <input
            id="pf-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Organic Tomato Seeds"
            required
          />
        </div>

        <div className="field field-full">
          <label htmlFor="pf-desc">Description *</label>
          <textarea
            id="pf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short product description"
            rows="3"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="pf-cat">Category *</label>
          <select
            id="pf-cat"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="" disabled>
              Select category
            </option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="pf-status">Status</label>
          <select
            id="pf-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="pf-price">Price (Rs.) *</label>
          <input
            id="pf-price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="pf-disc">Discount price</label>
          <input
            id="pf-disc"
            type="number"
            min="0"
            step="0.01"
            value={discountPrice}
            onChange={(e) => setDiscountPrice(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="pf-stock">Stock *</label>
          <input
            id="pf-stock"
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
          />
        </div>

        {fields.length > 0 && (
          <div className="field field-full">
            <h4 className="section-title">{selectedCategory.name} details</h4>
            <div className="form-grid subgroup">
              {fields.map((field) => (
                <AttributeField
                  key={field.key}
                  field={field}
                  value={attributes[field.key]}
                  onChange={updateAttribute}
                />
              ))}
            </div>
          </div>
        )}

        <div className="field field-full">
          <label>Images</label>
          <div className="image-uploader">
            <label className="upload-btn">
              Add images
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onFilesSelected}
              />
            </label>
            <span className="muted hint">JPEG, PNG, WebP or GIF (up to 5MB each)</span>
          </div>

          {(existingImages.length > 0 || newFiles.length > 0) && (
            <div className="image-preview-list">
              {existingImages.map((img) => (
                <div key={img} className="image-preview">
                  <img src={assetUrl(img)} alt="" />
                  <button
                    type="button"
                    className="remove-image"
                    onClick={() => removeExistingImage(img)}
                    aria-label="Remove image"
                  >
                    x
                  </button>
                </div>
              ))}
              {newFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="image-preview">
                  <img src={URL.createObjectURL(file)} alt="" />
                  <button
                    type="button"
                    className="remove-image"
                    onClick={() => removeNewFile(file)}
                    aria-label="Remove image"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={formInvalid || submitting}>
          {submitting ? "Saving..." : isEdit ? "Save Changes" : "Add Product"}
        </button>
      </div>
    </form>
  );
}