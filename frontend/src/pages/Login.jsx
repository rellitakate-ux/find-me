import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ScanLine } from "lucide-react";
import { post } from "../api.js";
import { Notice } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("professor@demo.edu");
  const [password, setPassword] = useState("DemoPass123!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await post("/auth/login", { email, password });
      setUser(response.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={login} className="card w-full max-w-md">
        <Link
          to="/login"
          className="flex items-center gap-2 font-bold text-2xl mb-7"
        >
          <ScanLine />
          Find Me
        </Link>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to your campus workspace</p>
        <Notice error={error} />
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          className="field"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          className="field"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="btn w-full mt-5" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="muted text-xs mt-5">
          Demo staff logins (development only): admin@demo.edu or
          professor@demo.edu. Password: DemoPass123!.
        </p>
        <p className="muted text-xs mt-1">
          Registration is controlled by the institution administrator.
        </p>
      </form>
    </main>
  );
}
