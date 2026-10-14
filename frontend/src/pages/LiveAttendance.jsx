import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ScanLine } from "lucide-react";
import { API, post } from "../api.js";
import { Heading, Notice } from "../components/Feedback.jsx";
import AttendanceEditButton from "../components/AttendanceEditButton.jsx";
import AuditHistory from "../components/AuditHistory.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLoad } from "../hooks/useLoad.js";

export default function LiveAttendance() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: sessions, reload, error } = useLoad("/sessions");
  const session = sessions?.find((item) => item.id === id);
  const [token, setToken] = useState("DEMO-RFID-001");
  const [scanError, setScanError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user.role !== "PROFESSOR" || !session) return undefined;
    const events = new EventSource(`${API}/api/sessions/${id}/events`, {
      withCredentials: true,
    });
    events.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (
        ["attendance", "attendance-corrected", "session-ended"].includes(
          event.type,
        )
      )
        reload();
    };
    return () => events.close();
  }, [id, user.role, Boolean(session)]);

  async function scan(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const recorded = await post("/simulator/scans", { sessionId: id, token });
      setSuccess(`${recorded.student.name}: ${recorded.status}`);
      setScanError("");
      reload();
    } catch (err) {
      setScanError(err.message);
      setSuccess("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Heading
        title={session?.class.name || "Session attendance"}
        subtitle="Verified check-ins and simulated RFID scans"
        action={
          <Link to="/attendance?tab=sessions" className="btn-secondary">
            Back to attendance
          </Link>
        }
      />
      <Notice error={error || scanError} ok={success} />
      {session && (
        <>
          <section className="card mb-5">
            <div className="flex justify-between items-center">
              <h3>Session status</h3>
              <span className="badge">{session.status}</span>
            </div>
            <p className="muted text-sm mt-2">
              Started {new Date(session.startsAt).toLocaleString()}
            </p>
          </section>
          {session.status === "ACTIVE" && user.role === "PROFESSOR" && (
            <form onSubmit={scan} className="card mb-5">
              <h3 className="flex gap-2 items-center">
                <ScanLine size={19} />
                Virtual RFID scanner
              </h3>
              <p className="muted text-sm mt-2">
                Use a registered demo token; do not enter raw personal
                information.
              </p>
              <label htmlFor="rfid-token">RFID simulation token</label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="rfid-token"
                  className="field flex-1"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                />
                <button disabled={busy} className="btn">
                  {busy ? "Checking…" : "Check in"}
                </button>
              </div>
            </form>
          )}
          <section className="card table-wrap">
            <h3 className="mb-3">Attendance records</h3>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Correction</th>
                </tr>
              </thead>
              <tbody>
                {session.attendance.map((item) => (
                  <tr key={item.id}>
                    <td>{item.student.name}</td>
                    <td>{item.student.studentNumber}</td>
                    <td>{item.status}</td>
                    <td>
                      {item.checkedInAt
                        ? new Date(item.checkedInAt).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <AttendanceEditButton
                        attendance={item}
                        onChanged={reload}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!session.attendance.length && (
              <p className="muted p-3">No check-ins yet.</p>
            )}
          </section>
          <AuditHistory sessionId={id} />
        </>
      )}
    </>
  );
}
