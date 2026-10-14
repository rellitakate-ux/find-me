import React from "react";
import { Link, useParams } from "react-router-dom";
import { Heading, Notice } from "../components/Feedback.jsx";
import { useLoad } from "../hooks/useLoad.js";

export default function ClassDetails() {
  const { id } = useParams();
  const { data: classInfo, error } = useLoad(`/classes/${id}`);
  return (
    <>
      <Heading
        title={classInfo?.name || "Class details"}
        subtitle={classInfo?.code || "Loading…"}
        action={
          <Link to="/management?tab=classes" className="btn-secondary">
            Back to classes
          </Link>
        }
      />
      <Notice error={error} />
      {classInfo && (
        <section className="card">
          <p>Room: {classInfo.classroom}</p>
          <p>Professor: {classInfo.professor.name}</p>
          <h2 className="mt-5 mb-3">Enrolled students</h2>
          {classInfo.enrollments.map((enrollment) => (
            <p className="border-b py-2" key={enrollment.id}>
              {enrollment.student.name} ({enrollment.student.studentNumber})
            </p>
          ))}
          {!classInfo.enrollments.length && (
            <p className="muted">No students enrolled.</p>
          )}
        </section>
      )}
    </>
  );
}
