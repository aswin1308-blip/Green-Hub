import { useCallback, useState } from "react";
import { api } from "../api.js";
import { AuthContext } from "./authContext.js";

const TOKEN_KEY = "gh_admin_token";
const USER_KEY = "gh_admin_user";

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    if (!data.user || data.user.role !== "admin") {
      throw new Error("This account does not have admin access");
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const isAdmin = Boolean(user && user.role === "admin");

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}