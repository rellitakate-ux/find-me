// Business rules shared by billing endpoints. Only authenticated admins can start checkout.
import {
  createHostedCheckout,
  parseSessionEvent,
  verifyXenditWebhook,
} from "../integrations/xendit.js";
import { fail } from "../utils/http.js";

export async function startCheckout(db, { user, planId, method }) {
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.priceCentavos < 100)
    throw fail(400, "Choose a paid subscription plan.");
  const subscription = await db.subscription.findUnique({
    where: { institutionId: user.institutionId },
  });
  if (!subscription)
    throw fail(
      409,
      "Institution subscription not found. Seed the database first.",
    );

  // PENDING is stored before calling Xendit; never trust a browser payment-success redirect.
  const payment = await db.payment.create({
    data: {
      institutionId: user.institutionId,
      subscriptionId: subscription.id,
      planId: plan.id,
      paymentMethod: method,
      amountCentavos: plan.priceCentavos,
      status: "PENDING",
    },
  });

  try {
    const checkout = await createHostedCheckout({ payment, plan, method });
    await db.payment.update({
      where: { id: payment.id },
      data: { checkoutId: checkout.checkoutId },
    });
    return { paymentId: payment.id, url: checkout.url };
  } catch (error) {
    // In the rare event that Xendit returned a session but our DB update failed,
    // this failed row still cannot activate via an unknown checkout ID.
    await db.payment
      .update({ where: { id: payment.id }, data: { status: "FAILED" } })
      .catch(() => {});
    throw error;
  }
}

export async function completeVerifiedWebhook(
  db,
  { payload, callbackToken, secret, expectedBusinessId },
) {
  if (!verifyXenditWebhook(callbackToken, secret))
    throw fail(401, "Invalid Xendit webhook token.");
  const event = parseSessionEvent(payload);
  if (!event) return { ignored: true };
  if (expectedBusinessId && event.businessId !== expectedBusinessId) {
    throw fail(403, "Xendit business ID does not match this account.");
  }
  if (
    typeof event.checkoutId !== "string" ||
    typeof event.referenceId !== "string"
  ) {
    throw fail(422, "Missing checkout identifiers in webhook.");
  }
  const payment = await db.payment.findUnique({
    where: { checkoutId: event.checkoutId },
  });
  // 503 permits retry on a very early callback that raced our DB update.
  if (!payment) throw fail(503, "Checkout not recorded yet; retry webhook.");
  if (event.referenceId !== payment.id)
    throw fail(422, "Payment reference does not match stored order.");

  if (event.event === "payment_session.expired") {
    if (event.status !== "EXPIRED") return { ignored: true };
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id = ${payment.subscriptionId} FOR UPDATE`;
      const current = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      if (current.status !== "PENDING") return { duplicate: true };
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      return { expired: true };
    });
  }

  // A completed one-time PAY session with automatic capture is the paid event.
  if (
    event.status !== "COMPLETED" ||
    event.sessionType !== "PAY" ||
    event.currency !== "PHP" ||
    event.country !== "PH" ||
    !Number.isFinite(event.amount) ||
    Math.abs(event.amount * 100 - payment.amountCentavos) > 0.000001 ||
    typeof event.providerPaymentId !== "string" ||
    !event.providerPaymentId
  ) {
    throw fail(422, "Webhook payment data does not match the original order.");
  }
  const plan = await db.subscriptionPlan.findUnique({
    where: { id: payment.planId },
  });
  if (
    !plan ||
    plan.priceCentavos !== payment.amountCentavos ||
    plan.durationDays < 1
  ) {
    throw fail(422, "Plan information does not match the payment.");
  }

  try {
    return await db.$transaction(async (tx) => {
      // Lock subscription row so duplicate callbacks/concurrent renewals do not extend twice.
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id = ${payment.subscriptionId} FOR UPDATE`;
      const current = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      if (current.status === "PAID") return { duplicate: true };
      if (current.status !== "PENDING")
        throw fail(409, "This payment is not pending.");
      const currentSub = await tx.subscription.findUnique({
        where: { id: payment.subscriptionId },
      });
      const base =
        currentSub.status === "ACTIVE" &&
        currentSub.expiresAt &&
        currentSub.expiresAt > new Date()
          ? currentSub.expiresAt
          : new Date();
      const expiry = new Date(base.getTime() + plan.durationDays * 86400000);
      await tx.webhookEvent.create({
        data: { providerEventId: `xendit:${event.checkoutId}:completed` },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          providerPaymentId: event.providerPaymentId,
        },
      });
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          planId: plan.id,
          status: "ACTIVE",
          expiresAt: expiry,
        },
      });
      return { activated: true };
    });
  } catch (error) {
    if (error.code === "P2002") {
      const persisted = await db.payment.findUnique({
        where: { id: payment.id },
      });
      if (persisted?.status === "PAID") return { duplicate: true };
      throw fail(409, "Conflicting payment reference.");
    }
    throw error;
  }
}
