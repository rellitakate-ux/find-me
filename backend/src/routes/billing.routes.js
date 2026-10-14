import { Router } from "express";
import { z } from "zod";
import { db } from "../config/database.js";
import { auth, roles } from "../middleware/auth.js";
import { safe } from "../utils/http.js";
import { accountLimitsForPlan } from "../services/accountLimitService.js";
import {
  startCheckout,
  completeVerifiedWebhook,
} from "../services/paymentService.js";

const router = Router();

router.get(
  "/api/plans",
  safe(async (_req, res) => {
    const plans = await db.subscriptionPlan.findMany({
      orderBy: { priceCentavos: "asc" },
    });
    res.json(plans.map((plan) => ({ ...plan, ...accountLimitsForPlan(plan) })));
  }),
);

router.get(
  "/api/subscription",
  auth,
  safe(async (req, res) => {
    const subscription = await db.subscription.findUnique({
      where: { institutionId: req.user.institutionId },
      include: { plan: true, payments: { orderBy: { createdAt: "desc" } } },
    });
    res.json(subscription);
  }),
);

router.post(
  "/api/payments/checkout",
  auth,
  roles("ADMIN"),
  safe(async (req, res) => {
    const { planId, method } = z
      .object({
        planId: z.string().min(1),
        method: z.enum(["gcash", "paymaya"]),
      })
      .parse(req.body);
    const session = await startCheckout(db, { user: req.user, planId, method });
    res.status(201).json(session);
  }),
);

// Provider-to-server request, no login cookie. Always authenticate x-callback-token.
router.post(
  "/api/payments/webhook",
  safe(async (req, res) => {
    const outcome = await completeVerifiedWebhook(db, {
      payload: req.body,
      callbackToken: req.get("x-callback-token"),
      secret: process.env.XENDIT_WEBHOOK_TOKEN,
      expectedBusinessId: process.env.XENDIT_BUSINESS_ID || undefined,
    });
    res.status(200).json({ ok: true, ...outcome });
  }),
);

export default router;
