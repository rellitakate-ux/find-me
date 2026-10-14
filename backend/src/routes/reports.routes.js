import { Router } from "express";
import { db } from "../config/database.js";
import { auth, roles } from "../middleware/auth.js";
import { safe, fail } from "../utils/http.js";
import { readStudentNumber } from "../services/studentDataService.js";
import { allowedPlan } from "../services/planService.js";
const router = Router();
router.get(
  "/api/reports/attendance.csv",
  auth,
  roles("ADMIN", "PROFESSOR"),
  safe(async (req, res) => {
    const plan = await allowedPlan(req.user);
    if (!plan.reportsEnabled)
      throw fail(402, "Report export requires a paid plan");
    const where = {
      class: {
        institutionId: req.user.institutionId,
        ...(req.user.role === "PROFESSOR" ? { professorId: req.user.id } : {}),
      },
    };
    const rows = await db.attendanceRecord.findMany({
      where: { session: where },
      include: { student: true, session: { include: { class: true } } },
    });
    const sanitize = (value) => {
      const raw = String(value ?? "");
      const safe = /^[=+@-]/.test(raw) ? "'" + raw : raw;
      return '"' + safe.replaceAll('"', '""') + '"';
    };
    const csv = [
      ["Class", "Student", "Number", "Status", "Checked In"],
      ...rows.map((a) => [
        a.session.class.code,
        a.student.name,
        readStudentNumber(a.student.studentNumber),
        a.status,
        a.checkedInAt?.toISOString() || "",
      ]),
    ]
      .map((row) => row.map(sanitize).join(","))
      .join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="attendance.csv"',
    );
    res.send(csv);
  }),
);

export default router;
