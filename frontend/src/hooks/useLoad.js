import { useCallback, useEffect, useState } from "react";
import { request } from "../api.js";

// Shared data-loading hook. Passing null skips the request for unauthorized views.
export function useLoad(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((previous) => previous + 1), []);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      setError("");
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError("");
    request(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);

  return { data, error, loading, reload };
}
