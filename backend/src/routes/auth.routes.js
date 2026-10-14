import { Router } from "express";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "../config/database.js";
import { auth } from "../middleware/auth.js";
import { digest } from "../utils/digest.js";
import { safe, fail, publicUser } from "../utils/http.js";
const router = Router();
router.post(
  "/api/auth/login",
  safe(async (req, res) => {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (
      !user ||
      !["ADMIN", "PROFESSOR"].includes(user.role) ||
      !(await argon2.verify(user.passwordHash, password))
    )
      throw fail(401, "Invalid email or password");
    const token = randomBytes(32).toString("hex");
    await db.authSession.create({
      data: {
        userId: user.id,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
    res
      .cookie("edutrack_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 60 * 60 * 1000,
        path: "/",
      })
      .json({ user: publicUser(user) });
  }),
);
router.post(
  "/api/auth/logout",
  auth,
  safe(async (req, res) => {
    await db.authSession.delete({ where: { id: req.authSession.id } });
    res.clearCookie("edutrack_session", { path: "/" }).json({ ok: true });
  }),
);
router.get("/api/auth/me", auth, (req, res) =>
  res.json({ user: publicUser(req.user) }),
);

export default router;
