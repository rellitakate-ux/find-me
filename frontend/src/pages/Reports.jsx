import React, { useState } from "react";
import { API } from "../api.js";
import { Heading, Notice } from "../components/Feedback.jsx";
import { useLoad } from "../hooks/useLoad.js";

export default function Reports({ embedded = false }) {
  const { data: sessions, error } = useLoad("/sessions");
  const { data: subscription, error: subscriptionError } =
    useLoad("/subscription");
  const exportEnabled =
    subscription?.status === "ACTIVE" &&
    (!subscription.expiresAt ||
      new Date(subscription.expiresAt) > new Date()) &&
    subscription.plan?.reportsEnabled === true;
  const [exportError, setExportError] = useState("");
  const [busy, setBusy] = useState(false);
  const records =
    sessions?.flatMap((session) =>
      session.attendance.map((record) => ({
        ...record,
        className: session.class.name,
      })),
    ) ?? [];

  async function download() {
    if (!exportEnabled) {
      setExportError("CSV export requires an active Basic or Premium plan.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/reports/attendance.csv`, {
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw Error(data.error || "Export failed");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "attendance.csv";
      link.click();
      URL.revokeObjectURL(objectUrl);
      setExportError("");
    } catch (err) {
      setExportError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {embedded ? (
        <div className="flex justify-between flex-wrap gap-3 items-center mb-4">
          <h2>Attendance report</h2>
          <button
            disabled={busy || !exportEnabled}
            className="btn"
            onClick={download}
          >
            {busy ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      ) : (
        <Heading
          title="Attendance reports"
          subtitle="Review saved attendance and export CSV"
          action={
            <button
              disabled={busy || !exportEnabled}
              className="btn"
              onClick={download}
            >
              {busy ? "Exporting…" : "Export CSV"}
            </button>
          }
        />
      )}
      <Notice error={error || subscriptionError || exportError} />
      {!exportEnabled && (
        <p className="muted text-sm mb-4">
          CSV downloads are included in Basic and Premium plans. You can still
          view attendance below.
        </p>
      )}
      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Student</th>
              <th>Status</th>
              <th>Check-in</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.className}</td>
                <td>{record.student.name}</td>
                <td>{record.status}</td>
                <td>
                  {record.checkedInAt
                    ? new Date(record.checkedInAt).toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!records.length && (
          <p className="muted p-3">No attendance records yet.</p>
        )}
      </section>
    </>
  );
}
