import React from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Heading } from "../components/Feedback.jsx";
import UsersPage from "./UsersPage.jsx";
import Classes from "./Classes.jsx";

// Students & staff and classes share one Management section.
// Professors can view their assigned classes but cannot manage users.
export default function Management() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const isAdmin = user.role === "ADMIN";
  const tab = isAdmin && params.get("tab") !== "classes" ? "people" : "classes";

  return (
    <>
      <Heading
        title="Management"
        subtitle={
          isAdmin
            ? "Register students, assign RFID cards, manage professors and classes."
            : "View your assigned classes and enrolled students."
        }
      />
      {isAdmin && (
        <div
          className="flex flex-wrap gap-2 mb-5"
          role="tablist"
          aria-label="Management options"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "people"}
            className={tab === "people" ? "btn" : "btn-secondary"}
            onClick={() => setParams({ tab: "people" })}
          >
            Students & professors
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "classes"}
            className={tab === "classes" ? "btn" : "btn-secondary"}
            onClick={() => setParams({ tab: "classes" })}
          >
            Classes & enrollment
          </button>
        </div>
      )}
      {tab === "people" ? <UsersPage embedded /> : <Classes embedded />}
      {isAdmin && tab === "people" && (
        <details className="card mt-5 text-sm">
          <summary className="cursor-pointer font-semibold">
            How student information is protected
          </summary>
          <p className="mt-3 muted">
            New student numbers are encrypted using AES-256-GCM before database
            storage. Only authorized Admin and Professor views decrypt them for
            class rosters, attendance records, and permitted CSV exports. RFID
            card identifiers are matched using a separate one-way digest, and
            professor passwords are hashed with Argon2.
          </p>
        </details>
      )}
    </>
  );
}
