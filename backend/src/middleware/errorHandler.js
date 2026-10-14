import { ZodError } from "zod";
export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError)
    return res
      .status(400)
      .json({
        error: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
  if (err.code === "P2002")
    return res.status(409).json({ error: "This record already exists" });
  if (err.code === "P2003")
    return res.status(400).json({ error: "Invalid related record" });
  console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.status ? err.message : "Internal server error" });
};
