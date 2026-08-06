import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminLayout from "./components/AdminLayout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Products from "./pages/Products.jsx";
import Categories from "./pages/Categories.jsx";
import Orders from "./pages/Orders.jsx";
import Customers from "./pages/Customers.jsx";
import Coupons from "./pages/Coupons.jsx";
import Banners from "./pages/Banners.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<Login />} />

      <Route path="/admin" element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="orders" element={<Orders />} />
          <Route path="customers" element={<Customers />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="banners" element={<Banners />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}