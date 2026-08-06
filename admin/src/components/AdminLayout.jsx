import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
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

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const current = NAV.find((item) => location.pathname.startsWith(item.to));

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
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