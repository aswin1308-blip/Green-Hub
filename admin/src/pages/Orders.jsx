import { useCallback, useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { useToast } from "../ui/useToast.js";
import { getOrders, updateOrderStatus } from "../api/orders.js";
import { assetUrl } from "../api.js";
import "./Orders.css";

const PAGE_SIZE = 10;

const ORDER_STATUSES = ["pending", "shipped", "delivered", "cancelled"];

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
  const label = value || "pending";
  return <span className={`badge badge-${type}-${label}`}>{label}</span>;
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
    setStatusDraft(order.orderStatus);
    setSelected(order);
    setDetailOpen(true);
  };

  const closeDetails = () => {
    if (updating) return;
    setDetailOpen(false);
    setSelected(null);
  };

  const handleStatusUpdate = async () => {
    if (!selected || !statusDraft || statusDraft === selected.orderStatus) return;
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
              {s.charAt(0).toUpperCase() + s.slice(1)}
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
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} className="order-row" onClick={() => openDetails(o)}>
                    <td>{shortId(o._id)}</td>
                    <td>
                      {o.user?.name || (
                        <span className="muted">Unknown customer</span>
                      )}
                      <div className="cell-sub muted">{o.user?.email}</div>
                    </td>
                    <td>Rs.{o.totalAmount}</td>
                    <td>
                      <StatusBadge value={o.paymentStatus} type="payment" />
                    </td>
                    <td>
                      <StatusBadge value={o.orderStatus} type="order" />
                    </td>
                    <td>{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
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
        width="640px"
      >
        {selected && (
          <div className="order-details">
            <section className="detail-grid">
              <div>
                <h4 className="section-title">Customer</h4>
                <p>
                  <strong>{selected.user?.name || "--"}</strong>
                </p>
                <p className="muted">{selected.user?.email}</p>
                <p className="muted">{selected.user?.phone || "No phone"}</p>
              </div>
              <div>
                <h4 className="section-title">Shipping address</h4>
                <p className="address-line">{selected.shippingAddress || "--"}</p>
              </div>
            </section>

            <div className="detail-grid">
              <div>
                <h4 className="section-title">Payment</h4>
                <p>
                  <StatusBadge value={selected.paymentStatus} type="payment" />{" "}
                  <span className="muted">
                    {selected.paymentId ? `• ${selected.paymentId}` : "No payment ID"}
                  </span>
                </p>
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
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={
                      !statusDraft ||
                      statusDraft === selected.orderStatus ||
                      updating
                    }
                    onClick={handleStatusUpdate}
                  >
                    {updating ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            </div>

            <h4 className="section-title">Items</h4>
            <div className="table-wrap">
              <table className="data-table items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item, idx) => {
                    const product = item.product;
                    return (
                      <tr key={idx}>
                        <td>
                          <div className="product-cell">
                            {product?.images?.[0] ? (
                              <img
                                className="thumb thumb-sm"
                                src={assetUrl(product.images[0])}
                                alt={product.name || "Product"}
                              />
                            ) : (
                              <div className="thumb thumb-sm thumb-empty"></div>
                            )}
                            <span className="product-name">
                              {product?.name || "Deleted product"}
                            </span>
                          </div>
                        </td>
                        <td>{item.quantity}</td>
                        <td>Rs.{item.price}</td>
                        <td>Rs.{item.quantity * item.price}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="order-total">
              <span>Total amount</span>
              <strong>Rs.{selected.totalAmount}</strong>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}