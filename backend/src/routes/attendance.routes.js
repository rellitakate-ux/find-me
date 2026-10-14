import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../config/database.js";
import { auth, roles } from "../middleware/auth.js";
import { safe, fail } from "../utils/http.js";
import { ownedClass } from "../services/classService.js";
import { broadcast, bus } from "../services/liveEvents.js";
import { processScan } from "../services/attendanceService.js";
import { attendanceForStaff } from "../services/studentDataService.js";
const router = Router();
router.post(
  "/api/simulator/scans",
  auth,
  roles("PROFESSOR"),
  safe(async (req, res) => {
    const { sessionId, token, eventId } = z
      .object({
        sessionId: z.string(),
        token: z.string().min(1),
        eventId: z.string().uuid().optional(),
      })
      .parse(req.body);
    res
      .status(201)
      .json(
        await processScan({
          sessionId,
          token,
          eventId: eventId || randomUUID(),
          actor: req.user,
        }),
      );
  }),
);
router.get(
  "/api/sessions/:id/events",
  auth,
  roles("PROFESSOR"),
  safe(async (req, res) => {
    const session = await db.classSession.findUnique({
      where: { id: req.params.id },
    });
    if (!session) throw fail(404, "Session not found");
    await ownedClass(req.user, session.classId);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const set = bus.get(session.id) || new Set();
    set.add(send);
    bus.set(session.id, set);
    send({ type: "connected" });
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(heartbeat);
      set.delete(send);
      if (!set.size) bus.delete(session.id);
    });
  }),
);
// Attendance corrections preserve an audit trail, including the reason and old/new status.
router.patch(
  "/api/attendance/:id",
  auth,
  roles("ADMIN", "PROFESSOR"),
  safe(async (req, res) => {
    const { status, reason } = z
      .object({
        status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]),
        reason: z.string().trim().min(5).max(500),
      })
      .parse(req.body);
    const record = await db.attendanceRecord.findUnique({
      where: { id: req.params.id },
      include: { session: { include: { class: true } } },
    });
    if (
      !record ||
      record.session.class.institutionId !== req.user.institutionId
    )
      throw fail(404, "Attendance record not found");
    if (
      req.user.role === "PROFESSOR" &&
      record.session.class.professorId !== req.user.id
    )
      throw fail(403, "Not your assigned class");
    if (record.status === status)
      throw fail(409, "Select a different attendance status");
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AttendanceRecord" WHERE id = ${record.id} FOR UPDATE`;
      const current = await tx.attendanceRecord.findUnique({
        where: { id: record.id },
      });
      if (current.status === status)
        throw fail(409, "Status was already changed");
      const changed = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: { status },
        include: {
          student: { select: { id: true, name: true, studentNumber: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          institutionId: req.user.institutionId,
          actorId: req.user.id,
          action: "ATTENDANCE_CORRECTED",
          details: {
            attendanceId: record.id,
            sessionId: record.sessionId,
            oldStatus: current.status,
            newStatus: status,
            reason,
          },
        },
      });
      return changed;
    });
    const safeResult = attendanceForStaff(result);
    broadcast(record.sessionId, {
      type: "attendance-corrected",
      attendance: safeResult,
    });
    res.json(safeResult);
  }),
);
router.get(
  "/api/sessions/:id/audit",
  auth,
  roles("ADMIN", "PROFESSOR"),
  safe(async (req, res) => {
    const session = await db.classSession.findUnique({
      where: { id: req.params.id },
    });
    if (!session) throw fail(404, "Session not found");
    await ownedClass(req.user, session.classId);
    res.json(
      await db.auditLog.findMany({
        where: {
          institutionId: req.user.institutionId,
          action: "ATTENDANCE_CORRECTED",
          details: { path: ["sessionId"], equals: session.id },
        },
        include: { actor: { select: { name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }),
);

export default router;
