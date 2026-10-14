import React, { useState } from "react";
import { Link } from "react-router-dom";
import { post } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLoad } from "../hooks/useLoad.js";
import { Heading, Notice } from "../components/Feedback.jsx";

export default function Sessions({ embedded = false }) {
  const { user } = useAuth();
  const { data: sessions, error, reload } = useLoad("/sessions");
  const { data: classes } = useLoad("/classes");
  const [classId, setClassId] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await post("/sessions", { classId });
      setActionError("");
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function end(sessionId) {
    if (!window.confirm("End this attendance session?")) return;
    setBusy(true);
    try {
      await post(`/sessions/${sessionId}/end`, {});
      setActionError("");
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!embedded && (
        <Heading
          title="Attendance sessions"
          subtitle="Start, review, and close classroom sessions"
        />
      )}
      <Notice error={actionError || error} />
      {user.role === "PROFESSOR" && (
        <form
          onSubmit={start}
          className="card flex flex-wrap items-end gap-3 mb-6"
        >
          <div className="flex-1 min-w-48">
            <label htmlFor="session-class">Choose class</label>
            <select
              id="session-class"
              className="field"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              required
            >
              <option value="">Select a class</option>
              {classes?.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.code} — {item.name}
                </option>
              ))}
            </select>
          </div>
          <button disabled={busy} className="btn">
            {busy ? "Please wait…" : "Start attendance session"}
          </button>
        </form>
      )}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Started</th>
              <th>Status</th>
              <th>Recorded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions?.map((session) => (
              <tr key={session.id}>
                <td>{session.class.name}</td>
                <td>{new Date(session.startsAt).toLocaleString()}</td>
                <td>
                  <span className="badge">{session.status}</span>
                </td>
                <td>{session.attendance.length}</td>
                <td className="flex gap-3 items-center">
                  <Link
                    className="text-blue-700 underline"
                    to={`/attendance/${session.id}`}
                  >
                    View
                  </Link>
                  {user.role === "PROFESSOR" && session.status === "ACTIVE" && (
                    <button
                      disabled={busy}
                      onClick={() => end(session.id)}
                      className="text-red-700 underline"
                    >
                      End
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sessions?.length && <p className="muted p-3">No sessions yet.</p>}
      </div>
    </>
  );
}
