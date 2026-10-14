import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import classesRoutes from "./routes/classes.routes.js";
import sessionsRoutes from "./routes/sessions.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(cookieParser());
// Xendit payment session webhooks use JSON and an x-callback-token header.
app.use(express.json({ limit: "128kb" }));
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

for (const router of [
  authRoutes,
  usersRoutes,
  classesRoutes,
  sessionsRoutes,
  attendanceRoutes,
  reportsRoutes,
  billingRoutes,
]) {
  app.use(router);
}
app.use(errorHandler);
