import React from "react";

export function Notice({ error, ok }) {
  return (
    <>
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 text-red-700 p-3 mb-3"
        >
          {error}
        </div>
      )}
      {ok && (
        <div
          role="status"
          className="rounded-lg bg-green-50 text-green-800 p-3 mb-3"
        >
          {ok}
        </div>
      )}
    </>
  );
}

export function Heading({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap gap-3 items-center justify-between mb-7">
      <div>
        <h1>{title}</h1>
        <p className="muted mt-1">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
