import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { getNotifications, markNotificationRead } from "../api/notifications.js";
import "./AdminLayout.css";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/coupons", label: "Coupons" },
  { to: "/admin/banners", label: "Homepage Banners" },
];

const POLL_MS = 30000;

const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRootRef = useRef(null);

  const current = NAV.find((item) => location.pathname.startsWith(item.to));

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, POLL_MS);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (notifRootRef.current && !notifRootRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  const handleNotificationClick = async (item) => {
    if (!item) return;
    if (!item.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((list) =>
        list.map((n) =>
          n._id === item._id ? { ...n, isRead: true } : n
        )
      );
      try {
        const data = await markNotificationRead(item._id);
        if (typeof data?.unreadCount === "number") setUnreadCount(data.unreadCount);
      } catch (err) {
        console.error("Failed to mark notification read:", err);
      }
    }
    setNotifOpen(false);
    navigate(item.orderId ? `/admin/orders?open=${item.orderId}` : "/admin/orders");
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          Green Hub
          <span className="brand-sub">Admin Panel</span>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              end={false}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <h1 className="page-title">{current ? current.label : "Admin"}</h1>
          <div className="topbar-right">
            <div className="notif-root" ref={notifRootRef}>
              <button
                type="button"
                className="notif-bell"
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : "Notifications"
                }
                aria-expanded={notifOpen}
                onClick={() => {
                  if (!notifOpen) loadNotifications();
                  setNotifOpen((o) => !o);
                }}
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="notif-panel" role="menu" aria-label="Notifications">
                  <div className="notif-panel-head">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="notif-panel-count">{unreadCount} unread</span>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <p className="notif-empty">No notifications yet.</p>
                    ) : (
                      notifications.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          className={`notif-item${item.isRead ? " is-read" : ""}`}
                          onClick={() => handleNotificationClick(item)}
                          role="menuitem"
                        >
                          <span className="notif-dot" aria-hidden="true"></span>
                          <span className="notif-item-body">
                            <span className="notif-message">{item.message}</span>
                            <span className="notif-time">{timeAgo(item.createdAt)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="admin-identity">
              {user?.name && <span className="admin-name">{user.name}</span>}
              <span className="admin-role">Administrator</span>
            </div>
            <button type="button" className="logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
