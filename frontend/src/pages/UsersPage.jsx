import React, { useEffect, useState } from "react";
import { request, post } from "../api.js";
import RFIDRegistration from "../components/RFIDRegistration.jsx";
import { Heading, Notice } from "../components/Feedback.jsx";

export default function UsersPage({ embedded = false }) {
  const [people, setPeople] = useState([]);
  const [student, setStudent] = useState({ name: "", studentNumber: "" });
  const [professor, setProfessor] = useState({
    name: "",
    email: "",
    password: "",
    role: "PROFESSOR",
  });
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = people.find((person) => person.id === selectedId) || null;

  async function load() {
    const result = await request("/users");
    setPeople(result);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function saveStudent(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await post("/students", student);
      setStudent({ name: "", studentNumber: "" });
      await load();
      setNotice(
        "Student record created. Assign an RFID card before attendance scanning.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProfessor(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await post("/users", professor);
      setProfessor({ name: "", email: "", password: "", role: "PROFESSOR" });
      await load();
      setNotice("Professor login account created.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function updatedRfid(message) {
    await load();
    setNotice(message);
    setError("");
  }
  const students = people.filter((p) => p.role === "STUDENT");
  const professors = people.filter((p) => p.role === "PROFESSOR");
  return (
    <>
      {!embedded && (
        <Heading
          title="Students and professors"
          subtitle="Students are attendance records; only administrators and professors have login accounts."
        />
      )}
      <Notice error={error} ok={notice} />
      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <form onSubmit={saveStudent} className="card">
          <h2>Register student (no account)</h2>
          <p className="muted text-sm mb-3">
            A student does not need an email address or password.
          </p>
          <label htmlFor="student-name">Student name</label>
          <input
            id="student-name"
            className="field"
            required
            minLength={2}
            value={student.name}
            onChange={(e) => setStudent({ ...student, name: e.target.value })}
          />
          <label htmlFor="student-number">
            Student number (encrypted at rest)
          </label>
          <input
            id="student-number"
            className="field"
            required
            maxLength={60}
            value={student.studentNumber}
            onChange={(e) =>
              setStudent({ ...student, studentNumber: e.target.value })
            }
          />
          <button className="btn mt-4" disabled={busy}>
            {busy ? "Saving…" : "Register student"}
          </button>
        </form>
        <form onSubmit={saveProfessor} className="card">
          <h2>Create professor account</h2>
          <label htmlFor="prof-name">Professor name</label>
          <input
            id="prof-name"
            className="field"
            required
            minLength={2}
            value={professor.name}
            onChange={(e) =>
              setProfessor({ ...professor, name: e.target.value })
            }
          />
          <label htmlFor="prof-email">Login email</label>
          <input
            id="prof-email"
            type="email"
            className="field"
            required
            value={professor.email}
            onChange={(e) =>
              setProfessor({ ...professor, email: e.target.value })
            }
          />
          <label htmlFor="prof-pass">Temporary password (10+ characters)</label>
          <input
            id="prof-pass"
            type="password"
            className="field"
            minLength={10}
            required
            value={professor.password}
            onChange={(e) =>
              setProfessor({ ...professor, password: e.target.value })
            }
          />
          <button className="btn mt-4" disabled={busy}>
            {busy ? "Creating…" : "Create professor"}
          </button>
        </form>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card table-wrap">
          <h2>Students ({students.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Number</th>
                <th>RFID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.studentNumber || "—"}</td>
                  <td>{s.rfidRegistered ? "Registered" : "Not registered"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSelectedId(s.id)}
                    >
                      Manage RFID
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && (
            <p className="muted mt-3">No students registered.</p>
          )}
        </section>
        <section className="card table-wrap">
          <h2>Professor accounts ({professors.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {professors.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <RFIDRegistration
        student={selected}
        onUpdated={updatedRfid}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
