// Xendit Payment Sessions gateway. No card or wallet details pass through Find Me.
// Official API: https://docs.xendit.co/apidocs/create-session
import { timingSafeEqual } from "node:crypto";
import { fail } from "../utils/http.js";

export const WALLET_CHANNELS = Object.freeze({
  gcash: "GCASH",
  paymaya: "PAYMAYA",
});

function testKey() {
  const value = process.env.XENDIT_SECRET_KEY?.trim();
  if (!value)
    throw fail(
      503,
      "Xendit is not configured. Add XENDIT_SECRET_KEY in backend/.env.",
    );
  // Xendit uses separate development and production credentials; block live credentials here.
  if (!value.startsWith("xnd_development_")) {
    throw fail(
      503,
      "This Find Me build accepts only Xendit development/test secret keys.",
    );
  }
  return value;
}

// Avoid redirecting administrators to arbitrary URLs from external responses.
export function isTrustedCheckoutUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "xendit.co" ||
        host.endsWith(".xendit.co") ||
        host === "xen.to" ||
        host.endsWith(".xen.to"))
    );
  } catch {
    return false;
  }
}

export function buildSessionPayload({ payment, plan, method }) {
  const channel = WALLET_CHANNELS[method];
  if (!channel) throw fail(400, "Select GCash or Maya.");
  const amount = payment.amountCentavos / 100; // database stores centavos; Xendit expects PHP
  if (
    !Number.isSafeInteger(payment.amountCentavos) ||
    amount < 1 ||
    amount > 100000
  ) {
    throw fail(400, "Invalid payment amount for GCash/Maya.");
  }
  const payload = {
    reference_id: payment.id,
    session_type: "PAY",
    mode: "PAYMENT_LINK",
    capture_method: "AUTOMATIC",
    amount,
    currency: "PHP",
    country: "PH",
    locale: "en",
    description: `Find Me ${plan.name} access (${plan.durationDays} days)`,
    allowed_payment_channels: [channel],
    metadata: {
      paymentId: payment.id,
      institutionId: payment.institutionId,
      planId: plan.id,
    },
  };
  // Xendit requires HTTPS return URLs. On localhost omit these optional fields.
  // User can return to /billing manually and check payment status.
  const publicUrl = process.env.FRONTEND_PUBLIC_URL?.trim();
  if (publicUrl) {
    let parsed;
    try {
      parsed = new URL(publicUrl);
    } catch {
      throw fail(500, "Invalid FRONTEND_PUBLIC_URL.");
    }
    if (parsed.protocol !== "https:")
      throw fail(500, "FRONTEND_PUBLIC_URL must be HTTPS.");
    payload.success_return_url = new URL(
      "/billing?checkout=returned",
      parsed.origin,
    ).toString();
    payload.cancel_return_url = new URL(
      "/billing?checkout=cancelled",
      parsed.origin,
    ).toString();
  }
  return payload;
}

export async function createHostedCheckout({ payment, plan, method }) {
  const key = testKey();
  const payload = buildSessionPayload({ payment, plan, method });
  let response;
  try {
    response = await fetch("https://api.xendit.co/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw fail(
      502,
      "Cannot reach Xendit. Check your internet connection and try again.",
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      result.message || result.error_code || "Checkout request was rejected";
    throw fail(
      502,
      `Xendit: ${detail}. Confirm ${WALLET_CHANNELS[method]} is enabled for your account.`,
    );
  }
  if (
    typeof result.payment_session_id !== "string" ||
    !isTrustedCheckoutUrl(result.payment_link_url)
  ) {
    throw fail(
      502,
      "Xendit returned an incomplete or untrusted checkout session.",
    );
  }
  return {
    checkoutId: result.payment_session_id,
    url: result.payment_link_url,
  };
}

// Xendit sends x-callback-token (NOT PayMongo's HMAC signature).
export function verifyXenditWebhook(received, secret) {
  if (!secret || typeof received !== "string") return false;
  const actual = Buffer.from(received.trim(), "utf8");
  const expected = Buffer.from(secret.trim(), "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseSessionEvent(payload) {
  if (
    !payload ||
    !["payment_session.completed", "payment_session.expired"].includes(
      payload.event,
    )
  )
    return null;
  const data = payload.data;
  if (!data || typeof data !== "object")
    throw fail(400, "Missing payment session data.");
  return {
    event: payload.event,
    checkoutId: data.payment_session_id,
    referenceId: data.reference_id,
    status: data.status,
    sessionType: data.session_type,
    currency: data.currency,
    country: data.country,
    amount: data.amount,
    providerPaymentId: data.payment_id,
    businessId: payload.business_id || data.business_id,
  };
}
