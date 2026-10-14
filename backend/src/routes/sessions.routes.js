import { Router } from "express";
import { z } from "zod";
import { db } from "../config/database.js";
import { auth, roles } from "../middleware/auth.js";
import { safe, fail } from "../utils/http.js";
import { ownedClass } from "../services/classService.js";
import { allowedPlan } from "../services/planService.js";
import { broadcast } from "../services/liveEvents.js";
import { attendanceForStaff } from "../services/studentDataService.js";
const router = Router();
router.get(
  "/api/sessions",
  auth,
  safe(async (req, res) => {
    const classes = await db.class.findMany({
      where: {
        institutionId: req.user.institutionId,
        ...(req.user.role === "PROFESSOR" ? { professorId: req.user.id } : {}),
      },
      select: { id: true },
    });
    const sessions = await db.classSession.findMany({
      where: { classId: { in: classes.map((x) => x.id) } },
      include: {
        class: { select: { name: true, code: true } },
        attendance: {
          include: { student: { select: { name: true, studentNumber: true } } },
        },
      },
      orderBy: { startsAt: "desc" },
      take: 100,
    });
    res.json(
      sessions.map((s) => ({
        ...s,
        attendance: s.attendance.map(attendanceForStaff),
      })),
    );
  }),
);
router.post(
  "/api/sessions",
  auth,
  roles("PROFESSOR"),
  safe(async (req, res) => {
    const { classId } = z.object({ classId: z.string() }).parse(req.body);
    await ownedClass(req.user, classId);
    await allowedPlan(req.user);
    const result = await db.$transaction(async (tx) => {
      // Lock class row to serialize concurrent session creation requests.
      await tx.$queryRaw`SELECT id FROM "Class" WHERE id = ${classId} FOR UPDATE`;
      const active = await tx.classSession.findFirst({
        where: { classId, status: "ACTIVE" },
      });
      if (active) throw fail(409, "This class already has an active session");
      return tx.classSession.create({ data: { classId } });
    });
    res.status(201).json(result);
  }),
);
router.post(
  "/api/sessions/:id/end",
  auth,
  roles("PROFESSOR"),
  safe(async (req, res) => {
    const session = await db.classSession.findUnique({
      where: { id: req.params.id },
    });
    if (!session) throw fail(404, "Session not found");
    await ownedClass(req.user, session.classId);
    if (session.status !== "ACTIVE") throw fail(409, "Session already closed");
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ClassSession" WHERE id = ${session.id} FOR UPDATE`;
      const current = await tx.classSession.findUnique({
        where: { id: session.id },
      });
      if (current.status !== "ACTIVE")
        throw fail(409, "Session already closed");
      const enrollment = await tx.enrollment.findMany({
        where: { classId: session.classId },
      });
      for (const e of enrollment)
        await tx.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: e.studentId,
            },
          },
          update: {},
          create: {
            sessionId: session.id,
            studentId: e.studentId,
            status: "ABSENT",
          },
        });
      await tx.classSession.update({
        where: { id: session.id },
        data: { status: "COMPLETED", endsAt: new Date() },
      });
    });
    broadcast(session.id, { type: "session-ended" });
    res.json({ ok: true });
  }),
);

export default router;
