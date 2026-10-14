import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLoad } from "../hooks/useLoad.js";
import { Heading, Notice } from "../components/Feedback.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: classes, error: classesError } = useLoad("/classes");
  const { data: sessions, error: sessionsError } = useLoad("/sessions");
  const active = (sessions ?? []).filter((item) => item.status === "ACTIVE");
  const metrics = [
    [
      user.role === "ADMIN" ? "Institution classes" : "My classes",
      classes?.length ?? "—",
    ],
    ["Active sessions", active.length],
    ["Recorded sessions", sessions?.length ?? "—"],
  ];

  return (
    <>
      <Heading
        title={`Welcome, ${user.name.split(" ")[0]}!`}
        subtitle="Find Me RFID attendance overview"
      />
      <Notice error={classesError || sessionsError} />
      <section className="grid md:grid-cols-3 gap-4 mb-7">
        {metrics.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="muted text-sm">{label}</div>
            <div className="text-4xl font-bold mt-3">{value}</div>
          </div>
        ))}
      </section>
      <section className="card mb-5">
        <h2>What would you like to do?</h2>
        <div className="flex flex-wrap gap-3 mt-4">
          {user.role === "ADMIN" && (
            <Link className="btn" to="/management?tab=people">
              Register students & RFID
            </Link>
          )}
          <Link
            className={user.role === "ADMIN" ? "btn-secondary" : "btn"}
            to="/attendance?tab=sessions"
          >
            Open attendance
          </Link>
          <Link className="btn-secondary" to="/management?tab=classes">
            View classes
          </Link>
          {user.role === "ADMIN" && (
            <Link className="btn-secondary" to="/billing">
              Manage subscription
            </Link>
          )}
        </div>
      </section>
      <section className="card">
        <h2>How Find Me uses encryption</h2>
        <p className="muted mt-2 text-sm">
          New student numbers are encrypted with AES-256-GCM when registered and
          decrypted by the backend for authorized class rosters, attendance
          screens, and CSV exports. RFID credentials use a one-way digest for
          matching, while staff passwords are hashed. This directly protects
          data used by the attendance workflow.
        </p>
      </section>
    </>
  );
}
