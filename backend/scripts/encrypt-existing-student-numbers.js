// Review with no arguments; use --apply only after backing up PostgreSQL.
// One transaction, no schema changes or deletions.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  encryptStudentNumber,
  hasProtectedStudentNumber,
  readStudentNumber,
} from "../src/services/studentDataService.js";
const db = new PrismaClient();
try {
  const students = await db.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, studentNumber: true },
  });
  const plaintext = students.filter(
    (s) => s.studentNumber && !hasProtectedStudentNumber(s.studentNumber),
  );
  const encrypted = students.filter((s) =>
    hasProtectedStudentNumber(s.studentNumber),
  );
  // Verify we still have the correct key before changing ANY old records.
  for (const s of encrypted) readStudentNumber(s.studentNumber);
  console.log(
    `Student records: ${students.length}; already encrypted: ${encrypted.length}; need encryption: ${plaintext.length}`,
  );
  if (!process.argv.includes("--apply")) {
    console.log(
      "DRY RUN ONLY. Back up your database, then rerun with --apply.",
    );
  } else {
    await db.$transaction(
      async (tx) => {
        for (const s of plaintext) {
          await tx.user.update({
            where: { id: s.id },
            data: { studentNumber: encryptStudentNumber(s.studentNumber) },
          });
        }
      },
      { timeout: 30000 },
    );
    console.log(`Encrypted ${plaintext.length} existing student numbers.`);
  }
} catch (error) {
  console.error("Migration stopped:", error.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
