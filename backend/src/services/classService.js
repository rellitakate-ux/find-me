import { db } from "../config/database.js";
import { fail } from "../utils/http.js";
import { studentForStaff } from "./studentDataService.js";
export async function ownedClass(user, id) {
  const klass = await db.class.findFirst({
    where: { id, institutionId: user.institutionId },
    include: {
      enrollments: {
        include: {
          student: { select: { id: true, name: true, studentNumber: true } },
        },
      },
      professor: { select: { id: true, name: true } },
    },
  });
  if (!klass) throw fail(404, "Class not found");
  if (user.role === "PROFESSOR" && klass.professorId !== user.id)
    throw fail(403, "Not your class");
  klass.enrollments = klass.enrollments.map((e) => ({
    ...e,
    student: studentForStaff(e.student),
  }));
  return klass;
}
