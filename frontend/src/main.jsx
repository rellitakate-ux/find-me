import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { Guard } from "./components/AppShell.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Management from "./pages/Management.jsx";
import AttendanceWorkspace from "./pages/AttendanceWorkspace.jsx";
import ClassDetails from "./pages/ClassDetails.jsx";
import LiveAttendance from "./pages/LiveAttendance.jsx";
import Billing from "./pages/Billing.jsx";
import "./styles.css";

function RoleGuard({ allowed, children }) {
  const { user } = useAuth();
  return allowed.includes(user?.role) ? (
    children
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

function AppRoutes() {
  const { user } = useAuth();
  const protectedPage = (component, allowed) => (
    <Guard>
      {allowed ? (
        <RoleGuard allowed={allowed}>{component}</RoleGuard>
      ) : (
        component
      )}
    </Guard>
  );

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route path="/dashboard" element={protectedPage(<Dashboard />)} />
      <Route path="/management" element={protectedPage(<Management />)} />
      <Route
        path="/attendance"
        element={protectedPage(<AttendanceWorkspace />)}
      />
      <Route path="/billing" element={protectedPage(<Billing />, ["ADMIN"])} />

      {/* Full details stay available without additional sidebar pages. */}
      <Route path="/classes/:id" element={protectedPage(<ClassDetails />)} />
      <Route
        path="/attendance/:id"
        element={protectedPage(<LiveAttendance />)}
      />

      {/* Redirect previously bookmarked pages to their new sections. */}
      <Route
        path="/users"
        element={<Navigate to="/management?tab=people" replace />}
      />
      <Route
        path="/classes"
        element={<Navigate to="/management?tab=classes" replace />}
      />
      <Route
        path="/sessions"
        element={<Navigate to="/attendance?tab=sessions" replace />}
      />
      <Route
        path="/reports"
        element={<Navigate to="/attendance?tab=reports" replace />}
      />
      <Route path="/settings" element={<Navigate to="/management" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
