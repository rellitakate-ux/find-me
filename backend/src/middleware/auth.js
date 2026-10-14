import { db } from "../config/database.js";
import { digest } from "../utils/digest.js";
import { fail } from "../utils/http.js";
export async function auth(req, res, next) {
  try {
    const token = req.cookies.edutrack_session;
    if (!token) throw fail(401, "Please log in");
    const session = await db.authSession.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.expiresAt <= new Date() ||
      !["ADMIN", "PROFESSOR"].includes(session.user.role)
    )
      throw fail(401, "Session expired");
    req.user = session.user;
    req.authSession = session;
    next();
  } catch (e) {
    next(e);
  }
}

export const roles =
  (...allowed) =>
  (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : next(fail(403, "Insufficient permissions"));
