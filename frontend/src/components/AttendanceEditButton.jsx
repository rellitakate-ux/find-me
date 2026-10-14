import React, { useState } from "react";
import { patch } from "../api";

export default function AttendanceEditButton({ attendance, onChanged }) {
  const [busy, setBusy] = useState(false);
  async function correct() {
    const status = window.prompt(
      "Correct attendance status to: PRESENT, LATE, ABSENT, or EXCUSED",
      attendance.status,
    );
    if (status === null) return;
    const normalized = status.trim().toUpperCase();
    if (!["PRESENT", "LATE", "ABSENT", "EXCUSED"].includes(normalized)) {
      window.alert("Invalid status.");
      return;
    }
    if (normalized === attendance.status) {
      window.alert("Choose a different status.");
      return;
    }
    const reason = window.prompt(
      "Reason for correction (at least 5 characters):",
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      window.alert("Please enter a clear reason.");
      return;
    }
    setBusy(true);
    try {
      await patch(`/attendance/${attendance.id}`, {
        status: normalized,
        reason: reason.trim(),
      });
      onChanged();
    } catch (e) {
      window.alert(`Unable to correct attendance: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      className="btn-secondary text-xs"
      disabled={busy}
      onClick={correct}
    >
      {busy ? "Saving…" : "Edit"}
    </button>
  );
}
