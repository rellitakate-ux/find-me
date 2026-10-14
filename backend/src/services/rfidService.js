import { digest } from "../utils/digest.js";
import { fail } from "../utils/http.js";

// Student RFID credentials belong to a user, not a particular class.
// Accept a database instance so this service can be tested independently.
export async function registerRfidCredential(
  db,
  { studentId, institutionId, actorId, token, replace = false },
) {
  const normalizedToken = token.trim();

  if (normalizedToken.length < 4 || normalizedToken.length > 128) {
    throw fail(400, "RFID credential must have 4 to 128 characters.");
  }

  // Matches the lookup already used by attendanceService.js.
  const tokenDigest = digest(normalizedToken);

  try {
    return await db.$transaction(async (tx) => {
      // Serialize changes for the same student.
      await tx.$queryRaw`
        SELECT "id" FROM "User" WHERE "id" = ${studentId} FOR UPDATE
      `;

      const student = await tx.user.findFirst({
        where: { id: studentId, institutionId, role: "STUDENT" },
        select: { id: true },
      });

      if (!student) {
        throw fail(404, "Student not found in your institution.");
      }

      const existing = await tx.rFIDCredential.findMany({
        where: { studentId },
        select: { id: true, tokenDigest: true },
      });

      const duplicate = await tx.rFIDCredential.findUnique({
        where: { tokenDigest },
        select: { studentId: true },
      });

      if (duplicate && duplicate.studentId !== studentId) {
        throw fail(409, "This RFID credential is assigned to another student.");
      }

      if (existing.length === 1 && existing[0].tokenDigest === tokenDigest) {
        return { rfidRegistered: true, unchanged: true };
      }

      if (existing.length > 0 && !replace) {
        throw fail(
          409,
          "This student already has an RFID card. Choose Replace RFID.",
        );
      }

      // Transaction rollback preserves old credentials if creation fails.
      if (existing.length > 0) {
        await tx.rFIDCredential.deleteMany({ where: { studentId } });
      }

      await tx.rFIDCredential.create({ data: { studentId, tokenDigest } });

      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          action: existing.length > 0 ? "RFID_REPLACED" : "RFID_REGISTERED",
          details: { studentId },
        },
      });

      return { rfidRegistered: true, replaced: existing.length > 0 };
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw fail(409, "This RFID credential is already registered.");
    }
    throw error;
  }
}

export async function revokeRfidCredential(
  db,
  { studentId, institutionId, actorId },
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "User" WHERE "id" = ${studentId} FOR UPDATE
    `;

    const student = await tx.user.findFirst({
      where: { id: studentId, institutionId, role: "STUDENT" },
      select: { id: true },
    });

    if (!student) {
      throw fail(404, "Student not found in your institution.");
    }

    const result = await tx.rFIDCredential.deleteMany({ where: { studentId } });

    if (result.count > 0) {
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          action: "RFID_REVOKED",
          details: { studentId },
        },
      });
    }

    return { rfidRegistered: false, revoked: result.count > 0 };
  });
}
