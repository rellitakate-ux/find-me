import { db } from "../config/database.js";
import { fail } from "../utils/http.js";
import { digest } from "../utils/digest.js";
import { ownedClass } from "./classService.js";
import { broadcast } from "./liveEvents.js";
import { attendanceForStaff } from "./studentDataService.js";
export async function processScan({ sessionId, token, eventId, actor }) {
  if (actor.role !== "PROFESSOR") throw fail(403, "Professor only");
  const session = await db.classSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw fail(404, "Session not found");
  await ownedClass(actor, session.classId);
  const cred = await db.rFIDCredential.findUnique({
    where: { tokenDigest: digest(token) },
  });
  if (!cred) throw fail(400, "Unknown RFID credential");
  const enrolled = await db.enrollment.findUnique({
    where: {
      classId_studentId: {
        classId: session.classId,
        studentId: cred.studentId,
      },
    },
  });
  if (!enrolled) throw fail(400, "Student not enrolled");
  const attendance = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ClassSession" WHERE id = ${sessionId} FOR UPDATE`;
    const current = await tx.classSession.findUnique({
      where: { id: sessionId },
    });
    if (current.status !== "ACTIVE") throw fail(409, "Session is not active");
    if (await tx.scanEvent.findUnique({ where: { eventId } }))
      throw fail(409, "Repeated event ID");
    if (
      await tx.attendanceRecord.findUnique({
        where: {
          sessionId_studentId: { sessionId, studentId: cred.studentId },
        },
      })
    )
      throw fail(409, "Already checked in");
    const now = new Date(),
      late = now.getTime() - current.startsAt.getTime() > 15 * 60 * 1000;
    const a = await tx.attendanceRecord.create({
      data: {
        sessionId,
        studentId: cred.studentId,
        status: late ? "LATE" : "PRESENT",
        checkedInAt: now,
      },
      include: { student: { select: { name: true, studentNumber: true } } },
    });
    await tx.scanEvent.create({
      data: { eventId, sessionId, result: "ACCEPTED" },
    });
    return a;
  });
  const result = attendanceForStaff(attendance);
  broadcast(sessionId, { type: "attendance", attendance: result });
  return result;
}
