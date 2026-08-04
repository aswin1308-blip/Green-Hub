import { useCallback, useEffect, useState } from "react";
import ProductFormModal from "../components/ProductFormModal.jsx";
import Modal from "../ui/Modal.jsx";
import { useToast } from "../ui/useToast.js";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  updateStock,
} from "../api/products.js";
import { getCategories } from "../api/categories.js";
import { assetUrl } from "../api.js";
import "./Products.css";

const PAGE_SIZE = 10;

export default function Products() {
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [stockEditingId, setStockEditingId] = useState(null);
  const [stockValue, setStockValue] = useState("");

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.categories || []))
      .catch((err) => toast.error(err.message));
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProducts({
        search: query || undefined,
        category: categoryFilter || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setProducts(res.products || []);
      setTotal(res.total || 0);
      setPages(res.pages || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, categoryFilter, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setQuery("");
    setPage(1);
  };

  const changeCategory = (e) => {
    setCategoryFilter(e.target.value);
    setPage(1);
  };

  const goToPage = (p) => {
    if (p < 1 || p > pages) return;
    setPage(p);
  };

  const openAdd = () => {
    setFormError("");
    setEditingProduct(null);
    setFormOpen(true);
  };

  const openEdit = (product) => {
    setFormError("");
    setEditingProduct(product);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setEditingProduct(null);
    setFormError("");
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setFormError("");
    try {
      const fd = new FormData();
      fd.append("name", payload.name.trim());
      fd.append("description", payload.description.trim());
      fd.append("category", payload.category);
      fd.append("price", String(Number(payload.price)));
      fd.append("stock", String(Number(payload.stock)));
      if (payload.discountPrice !== "") {
        fd.append("discountPrice", String(Number(payload.discountPrice)));
      }
      fd.append("status", payload.status);
      fd.append("attributes", JSON.stringify(payload.attributes));
      payload.keepImages.forEach((img) => fd.append("images", img));
      if (editingProduct && payload.keepImages.length === 0) {
        fd.append("images", "");
      }
      payload.newFiles.forEach((file) => fd.append("images", file, file.name));

      if (editingProduct) {
        await updateProduct(editingProduct._id, fd);
        toast.success("Product updated successfully");
      } else {
        await createProduct(fd);
        toast.success("Product added successfully");
      }
      setFormOpen(false);
      setEditingProduct(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (product) => {
    const nextStatus = product.status === "active" ? "inactive" : "active";
    try {
      await updateProduct(product._id, { status: nextStatus });
      toast.success(`Product ${nextStatus === "active" ? "activated" : "deactivated"}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startStockEdit = (product) => {
    setStockEditingId(product._id);
    setStockValue(String(product.stock));
  };

  const saveStock = async (product) => {
    const value = Number(stockValue);
    if (Number.isNaN(value) || value < 0) {
      toast.error("Stock must be 0 or greater");
      return;
    }
    try {
      await updateStock(product._id, value);
      toast.success("Stock updated");
      setStockEditingId(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteProduct(confirmDelete._id);
      toast.success("Product deleted");
      setConfirmDelete(null);
      if (products.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const modalTitle = editingProduct ? "Edit Product" : "Add Product";

  return (
    <div className="products-page">
      <div className="toolbar">
        <form className="search-box" onSubmit={applySearch}>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
          />
          {searchInput && (
            <button type="button" className="btn btn-ghost" onClick={clearSearch}>
              Clear
            </button>
          )}
        </form>

        <select
          className="btn category-filter"
          value={categoryFilter}
          onChange={changeCategory}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <button type="button" className="btn btn-primary" onClick={openAdd}>
          Add Product
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p className="muted">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="muted">No products found.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div className="product-cell">
                        {p.images?.[0] ? (
                          <img
                            className="thumb"
                            src={assetUrl(p.images[0])}
                            alt={p.name}
                          />
                        ) : (
                          <div className="thumb thumb-empty"></div>
                        )}
                        <span className="product-name">{p.name}</span>
                      </div>
                    </td>
                    <td>{p.category?.name || "--"}</td>
                    <td>
                      {p.discountPrice > 0 ? (
                        <>
                          <span className="strike">Rs.{p.price}</span>{" "}
                          <span>Rs.{p.discountPrice}</span>
                        </>
                      ) : (
                        `Rs.${p.price}`
                      )}
                    </td>
                    <td>
                      {stockEditingId === p._id ? (
                        <div className="stock-editor">
                          <input
                            type="number"
                            min="0"
                            autoFocus
                            value={stockValue}
                            onChange={(e) => setStockValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveStock(p);
                              if (e.key === "Escape") setStockEditingId(null);
                            }}
                          />
                          <button type="button" onClick={() => saveStock(p)}>
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setStockEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="stock-view"
                          onClick={() => startStockEdit(p)}
                          title="Quick edit stock"
                        >
                          {p.stock}
                        </button>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${p.status === "active" ? "badge-active" : "badge-inactive"}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleToggleStatus(p)}
                        >
                          {p.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(p)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setConfirmDelete(p)}
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

        {!loading && products.length > 0 && (
          <div className="pagination">
            <span className="muted">
              Showing {from}-{to} of {total}
            </span>
            <div className="pager">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Previous
              </button>
              <span className="page-indicator">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page >= pages}
                onClick={() => goToPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={formOpen} title={modalTitle} onClose={closeForm} width="720px">
        <ProductFormModal
          open={formOpen}
          product={editingProduct}
          categories={categories}
          onSubmit={handleSubmit}
          onClose={closeForm}
          submitting={submitting}
          error={formError}
        />
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title="Delete product"
        onClose={() => setConfirmDelete(null)}
        width="420px"
      >
        <p>
          Are you sure you want to delete{" "}
          <strong>{confirmDelete?.name}</strong>? This action cannot be undone.
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