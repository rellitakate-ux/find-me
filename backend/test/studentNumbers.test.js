import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encryptStudentNumber,
  readStudentNumber,
  hasProtectedStudentNumber,
  studentForStaff,
} from "../src/services/studentDataService.js";

test("encrypted student numbers decrypt only with configured AES key", () => {
  const old = process.env.DATA_ENCRYPTION_KEY;
  try {
    process.env.DATA_ENCRYPTION_KEY = "1".repeat(64);
    const first = encryptStudentNumber("2026-001");
    const second = encryptStudentNumber("2026-001");
    assert.ok(hasProtectedStudentNumber(first));
    assert.notEqual(first, second); // Fresh IV prevents deterministic ciphertext.
    assert.equal(readStudentNumber(first), "2026-001");
    assert.equal(
      studentForStaff({ studentNumber: first }).studentNumber,
      "2026-001",
    );
    assert.equal(readStudentNumber("legacy-student-id"), "legacy-student-id");
    assert.throws(() =>
      readStudentNumber(
        first.slice(0, -1) + (first.at(-1) === "a" ? "b" : "a"),
      ),
    );
  } finally {
    if (old === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = old;
  }
});
