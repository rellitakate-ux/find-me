import { fail } from "../utils/http.js";

// Free plan accounts: up to 50 students and 3 professors.
// Other plans currently have no account caps configured.
// Class and report limits remain controlled by the existing plan data.
export function accountLimitsForPlan(plan) {
  if (plan?.name === "Free") {
    return { maxStudents: 50, maxProfessors: 3 };
  }

  return { maxStudents: null, maxProfessors: null };
}

export async function createInstitutionMember(db, { institutionId, userData }) {
  if (!["STUDENT", "PROFESSOR"].includes(userData.role)) {
    throw fail(400, "Only student and professor accounts can be created here.");
  }

  return db.$transaction(async (tx) => {
    // Serializes account creation for the same institution so two requests
    // cannot both create the 51st student or the 4th professor.
    await tx.$queryRaw`
      SELECT "id" FROM "Institution"
      WHERE "id" = ${institutionId}
      FOR UPDATE
    `;

    const subscription = await tx.subscription.findUnique({
      where: { institutionId },
      include: { plan: true },
    });

    if (
      !subscription ||
      subscription.status !== "ACTIVE" ||
      (subscription.expiresAt && subscription.expiresAt <= new Date())
    ) {
      throw fail(402, "Institution subscription is not active.");
    }

    const limits = accountLimitsForPlan(subscription.plan);
    const limit =
      userData.role === "STUDENT" ? limits.maxStudents : limits.maxProfessors;

    if (limit !== null) {
      const existing = await tx.user.count({
        where: { institutionId, role: userData.role },
      });

      if (existing >= limit) {
        const label = userData.role === "STUDENT" ? "students" : "professors";
        throw fail(403, `Free plan limit reached: ${limit} ${label} maximum.`);
      }
    }

    return tx.user.create({
      data: { ...userData, institutionId },
    });
  });
}
