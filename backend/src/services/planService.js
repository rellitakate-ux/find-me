import { db } from "../config/database.js";
import { fail } from "../utils/http.js";
export async function allowedPlan(user) {
  const sub = await db.subscription.findUnique({
    where: { institutionId: user.institutionId },
    include: { plan: true },
  });
  if (
    !sub ||
    sub.status !== "ACTIVE" ||
    (sub.expiresAt && sub.expiresAt < new Date())
  )
    throw fail(402, "Subscription inactive");
  return sub.plan;
}
