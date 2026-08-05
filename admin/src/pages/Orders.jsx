import { useCallback, useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { useToast } from "../ui/useToast.js";
import { getOrders, updateOrderStatus } from "../api/orders.js";
import { assetUrl } from "../api.js";
import "./Orders.css";

const PAGE_SIZE = 10;

const ORDER_STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

const money = (n) => `Rs.${Number(n || 0).toLocaleString("en-IN")}`;

const formatDate = (iso) => {
  if (!iso) return "--";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const shortId = (id) => (id ? `#${id.slice(-8).toUpperCase()}` : "--");

function StatusBadge({ value, type }) {
  const label = value || "Pending";
  return <span className={`badge badge-${type}-${label.toLowerCase()}`}>{label}</span>;
}

export default function Orders() {
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState("");
  const [updating, setUpdating] = useState(false);

  const [currentFilter, setCurrentFilter] = useState({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrders({
        status: currentFilter.status || undefined,
        from: currentFilter.from || undefined,
        to: currentFilter.to || undefined,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setOrders(res.orders || []);
      setTotal(res.total || 0);
      setPages(res.pages || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentFilter, search, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetails = (order) => {
    setStatusDraft(order.status);
    setSelected(order);
    setDetailOpen(true);
  };

  const closeDetails = () => {
    if (updating) return;
    setDetailOpen(false);
    setSelected(null);
  };

  const handleStatusUpdate = async () => {
    if (!selected || !statusDraft || statusDraft === selected.status) return;
    setUpdating(true);
    try {
      await updateOrderStatus(selected._id, statusDraft);
      toast.success(`Order marked as ${statusDraft}`);
      setDetailOpen(false);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const clearFilters = () => {
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setCurrentFilter({});
    setPage(1);
  };

  const applyRange = () => {
    setPage(1);
    setCurrentFilter({ status: statusFilter, from: fromDate, to: toDate });
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="orders-page">
      <div className="toolbar">
        <form className="search-box" onSubmit={applySearch}>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order ID or customer..."
            aria-label="Search orders"
          />
          {searchInput && (
            <button type="button" className="btn btn-ghost" onClick={clearSearch}>
              Clear
            </button>
          )}
        </form>

        <select
          className="btn filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="date-range">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
          />
          <span className="muted">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
          />
        </div>

        <button type="button" className="btn" onClick={applyRange}>
          Apply
        </button>
        {(statusFilter || fromDate || toDate || search) && (
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <p className="muted">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="muted">No orders found.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table order-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Products</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                  <th>Order Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const products = o.products || [];
                  const totalQty = products.reduce(
                    (s, p) => s + (parseInt(p.quantity, 10) || 0),
                    0
                  );
                  const first = products[0];
                  return (
                    <tr key={o._id} className="order-row" onClick={() => openDetails(o)}>
                      <td>{shortId(o._id)}</td>
                      <td>
                        {o.customerName || (
                          <span className="muted">Unknown customer</span>
                        )}
                        <div className="cell-sub muted">{o.customerEmail}</div>
                      </td>
                      <td>{o.customerPhone || "--"}</td>
                      <td>
                        {first ? (
                          <div className="product-cell">
                            {first.image ? (
                              <img
                                className="thumb thumb-sm"
                                src={assetUrl(first.image)}
                                alt={first.name || "Product"}
                              />
                            ) : (
                              <div className="thumb thumb-sm thumb-empty"></div>
                            )}
                            <span className="product-name">
                              {first.name || "Product"}
                              {products.length > 1
                                ? ` +${products.length - 1} more`
                                : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="muted">No items</span>
                        )}
                      </td>
                      <td>{totalQty}</td>
                      <td>{money(o.total)}</td>
                      <td>{o.paymentMethod || "--"}</td>
                      <td>
                        <StatusBadge value={o.status} type="order" />
                      </td>
                      <td>{formatDate(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="pagination">
            <span className="muted">
              Showing {from}-{to} of {total}
            </span>
            <div className="pager">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
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
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={detailOpen}
        title={`Order ${selected ? shortId(selected._id) : ""}`}
        onClose={closeDetails}
        width="680px"
      >
        {selected && (
          <div className="order-details">
            <section className="detail-grid">
              <div>
                <h4 className="section-title">Customer Details</h4>
                <p>
                  <strong>{selected.customerName || "--"}</strong>
                </p>
                <p className="muted">{selected.customerEmail}</p>
                <p className="muted">{selected.customerPhone || "No phone"}</p>
              </div>
              <div>
                <h4 className="section-title">Shipping Address</h4>
                <p className="address-line">{selected.customerAddress || "--"}</p>
              </div>
            </section>

            <div className="detail-grid">
              <div>
                <h4 className="section-title">Payment Method</h4>
                <p>{selected.paymentMethod || "--"}</p>
                <p className="muted">Placed {formatDate(selected.createdAt)}</p>
              </div>
              <div>
                <h4 className="section-title">Order status</h4>
                <div className="status-editor">
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    aria-label="Update order status"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={
                      !statusDraft ||
                      statusDraft === selected.status ||
                      updating
                    }
                    onClick={handleStatusUpdate}
                  >
                    {updating ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            </div>

            <h4 className="section-title">Products</h4>
            <div className="table-wrap">
              <table className="data-table items-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.products || []).map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        {item.image ? (
                          <img
                            className="thumb thumb-sm"
                            src={assetUrl(item.image)}
                            alt={item.name || "Product"}
                          />
                        ) : (
                          <div className="thumb thumb-sm thumb-empty"></div>
                        )}
                      </td>
                      <td>{item.name || "Deleted product"}</td>
                      <td>{money(item.price)}</td>
                      <td>{item.quantity}</td>
                      <td>
                        {money((Number(item.price) || 0) * (Number(item.quantity) || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="order-total">
              <span>
                Subtotal {money(selected.subtotal)} + Delivery{" "}
                {money(selected.deliveryCharge)}
              </span>
              <strong>Grand Total {money(selected.total)}</strong>
            </div>

            <h4 className="section-title">Timeline</h4>
            <div className="order-timeline">
              <div className="timeline-item">
                <span className="timeline-dot done"></span>
                <div>
                  <strong>Order placed</strong>
                  <p className="muted">{formatDate(selected.createdAt)}</p>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot done"></span>
                <div>
                  <strong>Last updated</strong>
                  <p className="muted">{formatDate(selected.updatedAt)}</p>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot active"></span>
                <div>
                  <strong>Current status</strong>
                  <p>
                    <StatusBadge value={selected.status} type="order" />
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}