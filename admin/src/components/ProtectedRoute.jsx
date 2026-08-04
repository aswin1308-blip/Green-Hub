import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

export default function ProtectedRoute() {
  const { isAdmin } = useAuth();
  const location = useLocation();

  if (!isAdmin) {
    return (
      <Navigate
        to="/admin/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <Outlet />;
}