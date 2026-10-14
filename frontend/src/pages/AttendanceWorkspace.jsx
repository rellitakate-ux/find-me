import React from "react";
import { useSearchParams } from "react-router-dom";
import { Heading } from "../components/Feedback.jsx";
import Sessions from "./Sessions.jsx";
import Reports from "./Reports.jsx";

// All attendance tasks are in one section; per-session live views remain linked.
export default function AttendanceWorkspace() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "reports" ? "reports" : "sessions";

  return (
    <>
      <Heading
        title="Attendance"
        subtitle="Start a session, scan student cards, review records, and export attendance."
      />
      <div
        className="flex flex-wrap gap-2 mb-5"
        role="tablist"
        aria-label="Attendance options"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sessions"}
          className={tab === "sessions" ? "btn" : "btn-secondary"}
          onClick={() => setParams({ tab: "sessions" })}
        >
          Sessions & RFID scanner
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "reports"}
          className={tab === "reports" ? "btn" : "btn-secondary"}
          onClick={() => setParams({ tab: "reports" })}
        >
          Records & CSV export
        </button>
      </div>
      {tab === "sessions" ? <Sessions embedded /> : <Reports embedded />}
    </>
  );
}
