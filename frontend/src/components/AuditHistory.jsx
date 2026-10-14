import React, { useState } from "react";
import { request } from "../api";

export default function AuditHistory({ sessionId }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setEvents(await request(`/sessions/${sessionId}/audit`));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card mt-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3>Attendance correction audit trail</h3>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={load}
        >
          {busy ? "Loading…" : "Load / Refresh history"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-red-700 mt-3">
          {error}
        </p>
      )}
      {events && (
        <div className="table-wrap mt-3">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Edited by</th>
                <th>Changed</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                  <td>{e.actor?.name}</td>
                  <td>
                    {e.details?.oldStatus} → {e.details?.newStatus}
                  </td>
                  <td>{e.details?.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <p className="muted">No corrections recorded.</p>
          )}
        </div>
      )}
    </section>
  );
}
