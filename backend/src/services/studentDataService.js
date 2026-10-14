import { encryptField, decryptField } from "./cryptoService.js";

// Encrypt a field that is actually used for class enrollment and attendance reporting.
// Existing plaintext student numbers are readable until the one-time migration is run.
const PREFIX = "enc:v1:";
export const hasProtectedStudentNumber = (value) =>
  typeof value === "string" && value.startsWith(PREFIX);

export function encryptStudentNumber(number) {
  if (!number || !number.trim()) throw Error("A student number is required");
  return PREFIX + encryptField(number.trim());
}

export function readStudentNumber(stored) {
  if (stored == null) return "";
  if (!hasProtectedStudentNumber(stored)) return stored; // legacy data only
  return decryptField(stored.slice(PREFIX.length));
}

export function studentForStaff(student) {
  if (!student) return student;
  return {
    ...student,
    studentNumber: readStudentNumber(student.studentNumber),
  };
}

export function attendanceForStaff(row) {
  return { ...row, student: studentForStaff(row.student) };
}
