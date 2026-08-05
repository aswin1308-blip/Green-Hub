import { useCallback, useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { useToast } from "../ui/useToast.js";
import {
  getCustomers,
  getCustomerOrders,
  toggleCustomerBlock,
} from "../api/customers.js";
import "./Customers.css";

const PAGE_SIZE = 10;

const formatDate = (iso) => {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString();
};

const shortId = (id) => (id ? `#${id.slice(-6).toUpperCase()}` : "--");

function OrderStatusTag({ status }) {
  return <span className={`badge badge-order-${(status || "pending").toLowerCase()}`}>{status || "pending"}</span>;
}

export default function Customers() {
  const toast = useToast();

  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [blockingId, setBlockingId] = useState(null);

  const [selected, setSelected] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomers({ search: search || undefined, page, limit: PAGE_SIZE });
      setCustomers(res.customers || []);
      setTotal(res.total || 0);
      setPages(res.pages || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleToggleBlock = async (customer) => {
    if (blockingId) return;
    setBlockingId(customer._id);
    try {
      const res = await toggleCustomerBlock(customer._id, !customer.isBlocked);
      toast.success(res.message);
      await load();
      if (selected && selected._id === customer._id) {
        setSelected((prev) => (prev ? { ...prev, isBlocked: !customer.isBlocked } : prev));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBlockingId(null);
    }
  };

  const openHistory = async (customer) => {
    setSelected(customer);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const res = await getCustomerOrders(customer._id);
      setHistory(res.orders || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setSelected(null);
    setHistory([]);
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="customers-page">
      <div className="toolbar">
        <form className="search-box" onSubmit={applySearch}>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            aria-label="Search customers"
          />
          {searchInput && (
            <button type="button" className="btn btn-ghost" onClick={clearSearch}>
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="card">
        {loading ? (
          <p className="muted">Loading customers...</p>
        ) : customers.length === 0 ? (
          <p className="muted">No customers found.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <button
                        type="button"
                        className="customer-link"
                        onClick={() => openHistory(c)}
                      >
                        {c.name}
                      </button>
                      <div className="muted sub">Joined {formatDate(c.createdAt)}</div>
                    </td>
                    <td>{c.email}</td>
                    <td>{c.phone || "--"}</td>
                    <td className="order-count">{c.orderCount}</td>
                    <td>
                      {c.isBlocked ? (
                        <span className="badge badge-blocked">Blocked</span>
                      ) : (
                        <span className="badge badge-active">Active</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm ${c.isBlocked ? "" : "btn-danger"}`}
                        disabled={blockingId === c._id}
                        onClick={() => handleToggleBlock(c)}
                      >
                        {blockingId === c._id
                          ? "Updating..."
                          : c.isBlocked
                            ? "Unblock"
                            : "Block"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && customers.length > 0 && (
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
        open={historyOpen}
        title={selected ? `Order history — ${selected.name}` : "Order history"}
        onClose={closeHistory}
        width="680px"
      >
        {selected && (
          <div className="customer-history">
            <div className="history-meta muted">
              {selected.email}
              {selected.phone ? ` • ${selected.phone}` : ""}
            </div>

            {historyLoading ? (
              <p className="muted">Loading orders...</p>
            ) : history.length === 0 ? (
              <p className="muted">No orders placed yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table history-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((o) => (
                      <tr key={o._id}>
                        <td>{shortId(o._id)}</td>
                        <td>{formatDate(o.createdAt)}</td>
                        <td>Rs.{o.total}</td>
                        <td>{o.paymentMethod || "--"}</td>
                        <td>
                          <OrderStatusTag status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}