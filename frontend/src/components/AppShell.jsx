import React, { useState } from "react";
import { Link, NavLink, Navigate, useNavigate } from "react-router-dom";
import {
  ScanLine,
  LayoutDashboard,
  FolderKanban,
  ClipboardCheck,
  Wallet,
  LogOut,
  Menu,
} from "lucide-react";
import { post } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Management", path: "/management", icon: FolderKanban },
  { label: "Attendance", path: "/attendance", icon: ClipboardCheck },
  { label: "Billing", path: "/billing", icon: Wallet, allowed: ["ADMIN"] },
];

export function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-10">Loading Find Me…</p>;
  return user ? (
    <AppShell>{children}</AppShell>
  ) : (
    <Navigate to="/login" replace />
  );
}

export default function AppShell({ children }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    try {
      await post("/auth/logout", {});
    } finally {
      setUser(null);
      navigate("/login");
    }
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`${menuOpen ? "block" : "hidden"} lg:block bg-[#082A45] text-white lg:w-60 w-full lg:min-h-screen p-5 shrink-0`}
      >
        <Link
          to="/dashboard"
          className="flex gap-2 items-center font-bold text-xl mb-9"
        >
          <ScanLine className="text-[#A9D4F2]" />
          Find Me
        </Link>
        <p className="text-xs uppercase text-[#a9d4f2] mb-3">
          {user.role.toLowerCase()} workspace
        </p>
        <nav className="grid gap-1">
          {navigation
            .filter((item) => !item.allowed || item.allowed.includes(user.role))
            .map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex gap-3 items-center p-3 rounded-xl ${isActive ? "bg-[#123B5D]" : "hover:bg-[#123B5D]/60"}`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
        </nav>
        <button
          className="flex items-center gap-2 mt-12 p-3 text-sm"
          onClick={logout}
        >
          <LogOut size={18} />
          Log out
        </button>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-5 lg:px-8 py-4 flex items-center justify-between">
          <button
            aria-label="Toggle menu"
            className="lg:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu />
          </button>
          <span className="text-sm muted">Find Me / Attendance workspace</span>
          <div className="font-semibold text-sm">
            {user.name} <span className="badge ml-2">{user.role}</span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
