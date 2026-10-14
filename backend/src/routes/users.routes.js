import { Router } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "../config/database.js";
import { auth, roles } from "../middleware/auth.js";
import { safe, fail, publicUser } from "../utils/http.js";
import {
  accountLimitsForPlan,
  createInstitutionMember,
} from "../services/accountLimitService.js";
import {
  encryptStudentNumber,
  readStudentNumber,
} from "../services/studentDataService.js";
import {
  registerRfidCredential,
  revokeRfidCredential,
} from "../services/rfidService.js";
const router = Router();

// Students are managed records, NOT login accounts. Only staff users have login credentials.
router.get(
  "/api/users",
  auth,
  roles("ADMIN", "PROFESSOR"),
  safe(async (req, res) => {
    const where = {
      institutionId: req.user.institutionId,
      ...(req.user.role === "PROFESSOR" ? { role: "STUDENT" } : {}),
    };
    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        studentNumber: true,
      },
      orderBy: { name: "asc" },
    });
    const studentIds = users
      .filter((u) => u.role === "STUDENT")
      .map((u) => u.id);
    const credentials = studentIds.length
      ? await db.rFIDCredential.findMany({
          where: { studentId: { in: studentIds } },
          select: { studentId: true },
        })
      : [];
    const registered = new Set(credentials.map((c) => c.studentId));
    res.json(
      users.map((u) =>
        u.role === "STUDENT"
          ? {
              id: u.id,
              name: u.name,
              role: "STUDENT",
              studentNumber: readStudentNumber(u.studentNumber),
              rfidRegistered: registered.has(u.id),
            }
          : {
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              rfidRegistered: false,
            },
      ),
    );
  }),
);

// Only professor and administrator accounts can authenticate. Admin account is seeded.
router.post(
  "/api/users",
  auth,
  roles("ADMIN"),
  safe(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2),
        email: z.string().email(),
        password: z.string().min(10),
        role: z.literal("PROFESSOR"),
      })
      .parse(req.body);
    const user = await createInstitutionMember(db, {
      institutionId: req.user.institutionId,
      userData: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: await argon2.hash(data.password),
        role: "PROFESSOR",
      },
    });
    res.status(201).json(publicUser(user));
  }),
);

// Creating a student requires no email or password. Database keeps an internal
// non-login User row for compatibility with existing Enrollment/Attendance relations.
router.post(
  "/api/students",
  auth,
  roles("ADMIN"),
  safe(async (req, res) => {
    const { name, studentNumber } = z
      .object({
        name: z.string().trim().min(2).max(120),
        studentNumber: z.string().trim().min(1).max(60),
      })
      .parse(req.body);
    const student = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Institution" WHERE "id" = ${req.user.institutionId} FOR UPDATE`;
      const sub = await tx.subscription.findUnique({
        where: { institutionId: req.user.institutionId },
        include: { plan: true },
      });
      if (
        !sub ||
        sub.status !== "ACTIVE" ||
        (sub.expiresAt && sub.expiresAt <= new Date())
      )
        throw fail(402, "Institution subscription is not active");
      const limit = accountLimitsForPlan(sub.plan).maxStudents;
      const count = await tx.user.count({
        where: { institutionId: req.user.institutionId, role: "STUDENT" },
      });
      if (limit !== null && count >= limit)
        throw fail(403, `Free plan limit reached: ${limit} students maximum.`);
      const current = await tx.user.findMany({
        where: { institutionId: req.user.institutionId, role: "STUDENT" },
        select: { studentNumber: true },
      });
      if (
        current.some(
          (s) => readStudentNumber(s.studentNumber) === studentNumber,
        )
      )
        throw fail(409, "Student number is already registered.");
      return tx.user.create({
        data: {
          institutionId: req.user.institutionId,
          role: "STUDENT",
          name,
          studentNumber: encryptStudentNumber(studentNumber),
          email: `student-${randomUUID()}@no-login.edutrack.invalid`,
          passwordHash: await argon2.hash(randomBytes(32).toString("hex")),
        },
      });
    });
    res
      .status(201)
      .json({
        id: student.id,
        name: student.name,
        role: "STUDENT",
        studentNumber,
      });
  }),
);

router.post(
  "/api/users/:userId/rfid",
  auth,
  roles("ADMIN"),
  safe(async (req, res) => {
    const { token, replace } = z
      .object({
        token: z.string().trim().min(4).max(128),
        replace: z.boolean().optional().default(false),
      })
      .parse(req.body);
    res.json(
      await registerRfidCredential(db, {
        studentId: req.params.userId,
        institutionId: req.user.institutionId,
        actorId: req.user.id,
        token,
        replace,
      }),
    );
  }),
);
router.post(
  "/api/users/:userId/rfid/revoke",
  auth,
  roles("ADMIN"),
  safe(async (req, res) => {
    res.json(
      await revokeRfidCredential(db, {
        studentId: req.params.userId,
        institutionId: req.user.institutionId,
        actorId: req.user.id,
      }),
    );
  }),
);
export default router;
