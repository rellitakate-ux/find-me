import { Router } from "express";
import { z } from "zod";
import { db } from "../config/database.js";
import { auth, roles } from "../middleware/auth.js";
import { safe, fail } from "../utils/http.js";
import { ownedClass } from "../services/classService.js";
import { allowedPlan } from "../services/planService.js";
const router = Router();
router.get(
  "/api/classes",
  auth,
  safe(async (req, res) => {
    const where = { institutionId: req.user.institutionId };
    if (req.user.role === "PROFESSOR") where.professorId = req.user.id;
    res.json(
      await db.class.findMany({
        where,
        include: {
          professor: { select: { id: true, name: true } },
          _count: { select: { enrollments: true, sessions: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  }),
);
router.post(
  "/api/classes",
  auth,
  roles("ADMIN"),
  safe(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(3),
        code: z.string().min(2),
        classroom: z.string().min(2),
        professorId: z.string(),
      })
      .parse(req.body);
    const professor = await db.user.findFirst({
      where: {
        id: data.professorId,
        institutionId: req.user.institutionId,
        role: "PROFESSOR",
      },
    });
    if (!professor) throw fail(400, "Invalid professor");
    const plan = await allowedPlan(req.user);
    const count = await db.class.count({
      where: { institutionId: req.user.institutionId },
    });
    if (count >= plan.maxClasses)
      throw fail(402, "Class limit reached; upgrade your subscription");
    res
      .status(201)
      .json(
        await db.class.create({
          data: { ...data, institutionId: req.user.institutionId },
        }),
      );
  }),
);
router.post(
  "/api/classes/:id/enrollments",
  auth,
  roles("ADMIN"),
  safe(async (req, res) => {
    const klass = await ownedClass(req.user, req.params.id);
    const { studentId } = z.object({ studentId: z.string() }).parse(req.body);
    const student = await db.user.findFirst({
      where: {
        id: studentId,
        institutionId: req.user.institutionId,
        role: "STUDENT",
      },
    });
    if (!student) throw fail(400, "Invalid student");
    res
      .status(201)
      .json(
        await db.enrollment.upsert({
          where: { classId_studentId: { classId: klass.id, studentId } },
          update: {},
          create: { classId: klass.id, studentId },
        }),
      );
  }),
);
router.get(
  "/api/classes/:id",
  auth,
  safe(async (req, res) => res.json(await ownedClass(req.user, req.params.id))),
);

export default router;
