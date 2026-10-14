import React, { useEffect, useState } from "react";
import { post } from "../api";

// Administrator-only panel; server also checks ADMIN permissions.
export default function RFIDRegistration({ student, onUpdated, onClose }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken("");
    setError("");
  }, [student?.id]);

  if (!student) return null;

  const endpoint = `/users/${encodeURIComponent(student.id)}/rfid`;

  async function handleRegister(event) {
    event.preventDefault();
    const cleaned = token.trim();

    if (
      student.rfidRegistered &&
      !window.confirm(
        `Replace ${student.name}'s existing RFID card? The old credential will stop working.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const result = await post(endpoint, {
        token: cleaned,
        replace: student.rfidRegistered,
      });
      setToken("");
      await onUpdated(
        result.unchanged
          ? "This RFID credential was already registered to the student."
          : result.replaced
            ? "RFID replaced. The old credential can no longer check in."
            : "RFID registered. The student can now use the simulated scanner.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (
      !window.confirm(
        `Revoke ${student.name}'s RFID card? They will no longer be able to check in with it.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await post(`${endpoint}/revoke`, {});
      setToken("");
      await onUpdated(
        "RFID revoked. This student no longer has an active registered credential.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-5" aria-label="RFID management">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h2>RFID Card Management</h2>
          <p className="muted mt-1">
            {student.name} — {student.studentNumber || student.email}
          </p>
          <p className="mt-2 text-sm">
            Status:{" "}
            <strong>
              {student.rfidRegistered ? "Registered" : "Not registered"}
            </strong>
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 mt-4 rounded-lg bg-red-50 text-red-700"
        >
          {error}
        </div>
      )}

      <form className="mt-4" onSubmit={handleRegister}>
        <label htmlFor="rfid-credential">Simulated RFID token / card UID</label>
        <input
          id="rfid-credential"
          className="field"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Example: CARD-2026-001"
          minLength={4}
          maxLength={128}
          required
          autoComplete="off"
        />
        <p className="muted text-sm mt-2">
          Use the same token in the professor's Virtual RFID Scanner. Card
          identifiers are case-sensitive. Do not use a student's password.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            className="btn"
            type="submit"
            disabled={busy || token.trim().length < 4}
          >
            {busy
              ? "Saving…"
              : student.rfidRegistered
                ? "Replace RFID"
                : "Register RFID"}
          </button>
          {student.rfidRegistered && (
            <button
              className="btn-secondary"
              type="button"
              disabled={busy}
              onClick={handleRevoke}
            >
              Revoke RFID
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
