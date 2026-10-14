import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionPayload,
  isTrustedCheckoutUrl,
  verifyXenditWebhook,
  createHostedCheckout,
} from "../src/integrations/xendit.js";
import {
  startCheckout,
  completeVerifiedWebhook,
} from "../src/services/paymentService.js";

const plan = {
  id: "plan-basic",
  name: "Basic",
  priceCentavos: 19900,
  durationDays: 30,
};
const order = {
  id: "pay-123",
  checkoutId: "ps-abc123",
  institutionId: "inst-1",
  subscriptionId: "sub-1",
  planId: plan.id,
  amountCentavos: 19900,
  paymentMethod: "gcash",
  status: "PENDING",
};
const webhook = {
  event: "payment_session.completed",
  business_id: "business-test",
  data: {
    payment_session_id: "ps-abc123",
    reference_id: "pay-123",
    status: "COMPLETED",
    session_type: "PAY",
    currency: "PHP",
    country: "PH",
    amount: 199,
    payment_id: "py-123",
  },
};

function fakeDb() {
  const payment = { ...order };
  const subscription = {
    id: "sub-1",
    institutionId: "inst-1",
    planId: "plan-free",
    status: "ACTIVE",
    expiresAt: null,
  };
  const db = {
    payment: {
      findUnique: async () => payment,
      create: async ({ data }) => Object.assign(payment, data),
      update: async ({ data }) => Object.assign(payment, data),
    },
    subscription: {
      findUnique: async () => subscription,
      update: async ({ data }) => Object.assign(subscription, data),
    },
    subscriptionPlan: { findUnique: async () => plan },
    webhookEvent: { create: async () => ({ id: "evt" }) },
    $queryRaw: async () => [],
    $transaction: async (fn) => fn(db),
  };
  return { db, payment, subscription };
}

const validArgs = (payload) => ({
  payload,
  callbackToken: "test-callback-token",
  secret: "test-callback-token",
});

test("GCash and Maya selections send their correct Xendit channel code", () => {
  for (const [method, channel] of [
    ["gcash", "GCASH"],
    ["paymaya", "PAYMAYA"],
  ]) {
    const body = buildSessionPayload({ payment: order, plan, method });
    assert.deepEqual(body.allowed_payment_channels, [channel]);
    assert.equal(body.amount, 199); // pesos; DB is centavos
    assert.equal(body.currency, "PHP");
    assert.equal(body.session_type, "PAY");
    assert.equal(body.reference_id, order.id);
  }
});

test("Only Xendit HTTPS redirect domains accepted", () => {
  assert.equal(
    isTrustedCheckoutUrl("https://checkout-staging.xendit.co/sessions/ps-abc"),
    true,
  );
  assert.equal(isTrustedCheckoutUrl("https://dev.xen.to/test"), true);
  assert.equal(isTrustedCheckoutUrl("http://xendit.co/unsafe"), false);
  assert.equal(isTrustedCheckoutUrl("https://xendit.co.attacker.org"), false);
});

test("Webhook token is checked and missing or incorrect token is rejected", () => {
  assert.equal(verifyXenditWebhook("secret", "secret"), true);
  assert.equal(verifyXenditWebhook("other", "secret"), false);
  assert.equal(verifyXenditWebhook(null, "secret"), false);
});

test("Completed one-time PHP payment activates its plan", async () => {
  const { db, payment, subscription } = fakeDb();
  const result = await completeVerifiedWebhook(db, validArgs(webhook));
  assert.deepEqual(result, { activated: true });
  assert.equal(payment.status, "PAID");
  assert.equal(payment.providerPaymentId, "py-123");
  assert.equal(subscription.planId, plan.id);
  assert.ok(subscription.expiresAt instanceof Date);
});

test("Duplicate callback does not extend subscription again", async () => {
  const { db, subscription } = fakeDb();
  await completeVerifiedWebhook(db, validArgs(webhook));
  const firstExpiry = subscription.expiresAt.getTime();
  const again = await completeVerifiedWebhook(db, validArgs(webhook));
  assert.equal(again.duplicate, true);
  assert.equal(subscription.expiresAt.getTime(), firstExpiry);
});

test("Wrong amount and reference never activate a plan", async () => {
  for (const modification of [
    { amount: 100 },
    { reference_id: "someone-else" },
  ]) {
    const { db, payment } = fakeDb();
    await assert.rejects(
      completeVerifiedWebhook(
        db,
        validArgs({ ...webhook, data: { ...webhook.data, ...modification } }),
      ),
    );
    assert.equal(payment.status, "PENDING");
  }
});

test("Bad callback token and business ID are rejected", async () => {
  const { db, payment } = fakeDb();
  await assert.rejects(
    completeVerifiedWebhook(db, {
      ...validArgs(webhook),
      callbackToken: "bad",
    }),
    /Invalid Xendit/,
  );
  await assert.rejects(
    completeVerifiedWebhook(db, {
      ...validArgs(webhook),
      expectedBusinessId: "wrong-business",
    }),
    /business ID/,
  );
  assert.equal(payment.status, "PENDING");
});

test("Failed/expired sessions do not grant access", async () => {
  const { db, payment, subscription } = fakeDb();
  const expired = {
    ...webhook,
    event: "payment_session.expired",
    data: { ...webhook.data, status: "EXPIRED" },
  };
  const result = await completeVerifiedWebhook(db, validArgs(expired));
  assert.equal(result.expired, true);
  assert.equal(payment.status, "FAILED");
  assert.equal(subscription.planId, "plan-free");
});

test("Checkout uses Xendit API and Basic Auth with test key (mock request)", async () => {
  const oldKey = process.env.XENDIT_SECRET_KEY;
  const oldFetch = globalThis.fetch;
  const oldPublic = process.env.FRONTEND_PUBLIC_URL;
  delete process.env.FRONTEND_PUBLIC_URL;
  process.env.XENDIT_SECRET_KEY = "xnd_development_unit_test";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.xendit.co/sessions");
    assert.match(options.headers.Authorization, /^Basic /);
    assert.equal(JSON.parse(options.body).allowed_payment_channels[0], "GCASH");
    return {
      ok: true,
      json: async () => ({
        payment_session_id: "ps-abc123",
        payment_link_url:
          "https://checkout-staging.xendit.co/sessions/ps-abc123",
      }),
    };
  };
  try {
    const out = await createHostedCheckout({
      payment: order,
      plan,
      method: "gcash",
    });
    assert.equal(out.checkoutId, "ps-abc123");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.XENDIT_SECRET_KEY;
    else process.env.XENDIT_SECRET_KEY = oldKey;
    if (oldPublic === undefined) delete process.env.FRONTEND_PUBLIC_URL;
    else process.env.FRONTEND_PUBLIC_URL = oldPublic;
  }
});

test("Checkout rejects missing or live keys and returns no checkout", async () => {
  const oldKey = process.env.XENDIT_SECRET_KEY;
  process.env.XENDIT_SECRET_KEY = "xnd_production_unsafe";
  try {
    await assert.rejects(
      createHostedCheckout({ payment: order, plan, method: "gcash" }),
      /development\/test/,
    );
  } finally {
    if (oldKey === undefined) delete process.env.XENDIT_SECRET_KEY;
    else process.env.XENDIT_SECRET_KEY = oldKey;
  }
});
