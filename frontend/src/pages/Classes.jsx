import React, { useState } from "react";
import { Link } from "react-router-dom";
import { post } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLoad } from "../hooks/useLoad.js";
import { Heading, Notice } from "../components/Feedback.jsx";

const emptyClass = { name: "", code: "", classroom: "", professorId: "" };

export default function Classes({ embedded = false }) {
  const { user } = useAuth();
  const { data: classes, error, reload } = useLoad("/classes");
  const { data: users } = useLoad("/users");
  const [form, setForm] = useState(emptyClass);
  const [target, setTarget] = useState("");
  const [student, setStudent] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createClass(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await post("/classes", form);
      setMessage("Class created");
      setActionError("");
      setForm(emptyClass);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function enrollStudent(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await post(`/classes/${target}/enrollments`, { studentId: student });
      setMessage("Student enrolled");
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
          title="Class management"
          subtitle="Manage classroom assignments and enrollments"
        />
      )}
      <Notice error={error || actionError} ok={message} />
      {user.role === "ADMIN" && (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <form onSubmit={createClass} className="card">
            <h3>Create a class</h3>
            {[
              ["name", "Subject name"],
              ["code", "Class code"],
              ["classroom", "Room"],
            ].map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`class-${key}`}>{label}</label>
                <input
                  id={`class-${key}`}
                  className="field"
                  required
                  value={form[key]}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                />
              </div>
            ))}
            <label htmlFor="class-professor">Professor</label>
            <select
              id="class-professor"
              className="field"
              required
              value={form.professorId}
              onChange={(event) =>
                setForm({ ...form, professorId: event.target.value })
              }
            >
              <option value="">Select professor</option>
              {users
                ?.filter((item) => item.role === "PROFESSOR")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <button className="btn mt-4" disabled={busy}>
              Create class
            </button>
          </form>
          <form onSubmit={enrollStudent} className="card">
            <h3>Enroll a student</h3>
            <label htmlFor="enrollment-class">Class</label>
            <select
              id="enrollment-class"
              className="field"
              required
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">Select class</option>
              {classes?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name}
                </option>
              ))}
            </select>
            <label htmlFor="enrollment-student">Student</label>
            <select
              id="enrollment-student"
              className="field"
              required
              value={student}
              onChange={(event) => setStudent(event.target.value)}
            >
              <option value="">Select student</option>
              {users
                ?.filter((item) => item.role === "STUDENT")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <button className="btn mt-4" disabled={busy}>
              Enroll student
            </button>
          </form>
        </div>
      )}
      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Subject</th>
              <th>Room</th>
              <th>Professor</th>
              <th>Students</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {classes?.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{item.classroom}</td>
                <td>{item.professor.name}</td>
                <td>{item._count.enrollments}</td>
                <td>
                  <Link
                    className="text-blue-700 underline"
                    to={`/classes/${item.id}`}
                  >
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!classes?.length && <p className="muted p-3">No classes found.</p>}
      </section>
    </>
  );
}
