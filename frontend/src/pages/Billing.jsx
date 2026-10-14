import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { post } from "../api.js";
import { Heading, Notice } from "../components/Feedback.jsx";
import { useLoad } from "../hooks/useLoad.js";

const peso = (centavos) => `₱${(centavos / 100).toFixed(2)}`;
const walletName = (method) =>
  method === "gcash" ? "GCash" : method === "paymaya" ? "Maya" : "—";

function PaymentHistory({ payments, plans }) {
  return (
    <section className="card mt-6">
      <h2>Payment history</h2>
      <p className="muted text-xs mt-1">
        Payments activate plans only after a verified Xendit webhook.
      </p>
      <div className="table-wrap mt-3">
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Plan</th>
              <th>Wallet</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments?.map((payment) => (
              <tr key={payment.id}>
                <td>{new Date(payment.createdAt).toLocaleString()}</td>
                <td>
                  {plans?.find((p) => p.id === payment.planId)?.name ?? "—"}
                </td>
                <td>{walletName(payment.paymentMethod)}</td>
                <td>{peso(payment.amountCentavos)}</td>
                <td>
                  <span className="badge">{payment.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!payments?.length && (
        <p className="muted mt-3">No payment transactions yet.</p>
      )}
    </section>
  );
}

function PlanCard({ plan, busy, onCheckout }) {
  return (
    <div className="card flex flex-col">
      <h2>{plan.name}</h2>
      <p className="text-3xl font-bold mt-3">
        {peso(plan.priceCentavos)}{" "}
        <span className="text-sm muted">/{plan.durationDays} days</span>
      </p>
      <p className="muted text-sm mt-3 mb-5">
        Up to {plan.maxClasses} classes ·{" "}
        {plan.maxStudents == null
          ? "No student cap set"
          : `Up to ${plan.maxStudents} students`}{" "}
        ·{" "}
        {plan.maxProfessors == null
          ? "No professor cap set"
          : `Up to ${plan.maxProfessors} professors`}{" "}
        ·{" "}
        {plan.reportsEnabled
          ? "CSV attendance exports"
          : "Basic attendance only"}
      </p>
      {plan.priceCentavos === 0 ? (
        <span className="badge text-center mt-auto">Free tier</span>
      ) : (
        <div className="grid gap-2 mt-auto">
          <button
            className="btn w-full"
            disabled={Boolean(busy)}
            onClick={() => onCheckout(plan, "gcash")}
          >
            {busy === `${plan.id}gcash`
              ? "Connecting…"
              : "Pay with GCash (test)"}
          </button>
          <button
            className="btn-secondary w-full"
            disabled={Boolean(busy)}
            onClick={() => onCheckout(plan, "paymaya")}
          >
            {busy === `${plan.id}paymaya`
              ? "Connecting…"
              : "Pay with Maya (test)"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  const { data: plans, error: plansError } = useLoad("/plans");
  const {
    data: subscription,
    error: subscriptionError,
    reload,
  } = useLoad("/subscription");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const result = new URLSearchParams(window.location.search).get("checkout");

  // A checkout return never proves payment. The subscription comes from the backend.
  useEffect(() => {
    if (result !== "returned") return undefined;
    let attempts = 0;
    const timer = setInterval(() => {
      reload();
      if (++attempts >= 12) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [result, reload]);

  async function checkout(plan, method) {
    if (
      !window.confirm(
        `Open Xendit TEST checkout for ${plan.name} (${peso(plan.priceCentavos)}) using ${walletName(method)}?`,
      )
    )
      return;
    try {
      setBusy(`${plan.id}${method}`);
      setError("");
      const { url } = await post("/payments/checkout", {
        planId: plan.id,
        method,
      });
      window.location.assign(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const active =
    subscription?.status === "ACTIVE" &&
    (!subscription.expiresAt || new Date(subscription.expiresAt) > new Date());

  return (
    <>
      <Heading
        title="Subscription and billing"
        subtitle="Xendit test-mode checkout for GCash and Maya; methods must be enabled in your Xendit account"
        action={
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={reload}
          >
            <RefreshCw size={16} />
            Refresh status
          </button>
        }
      />
      <Notice error={plansError || subscriptionError || error} />
      {result === "returned" && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 text-[#082A45] p-4 mb-5"
        >
          Returned from Xendit. Payment is <strong>not confirmed yet</strong>.
          Status refreshes after webhook verification.
        </p>
      )}
      {result === "cancelled" && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 text-amber-900 p-4 mb-5"
        >
          Checkout cancelled. Your current plan remains unchanged.
        </p>
      )}
      <section className="card mb-6">
        <p className="muted text-sm">Current institutional plan</p>
        <div className="flex items-center justify-between gap-4">
          <h2>
            {subscription
              ? active
                ? subscription.plan.name
                : "Inactive"
              : "Loading…"}
          </h2>
          <span className="badge">{active ? "ACTIVE" : "INACTIVE"}</span>
        </div>
        <p className="muted text-sm mt-1">
          {subscription?.expiresAt
            ? `Valid until ${new Date(subscription.expiresAt).toLocaleDateString()}`
            : "No expiration date set"}
        </p>
        <p className="muted text-xs mt-3">
          Development/test only. On localhost, Xendit may not redirect back
          automatically—return to Billing and click Refresh status.
        </p>
      </section>
      <section className="grid md:grid-cols-3 gap-4">
        {plans?.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            busy={busy}
            onCheckout={checkout}
          />
        ))}
      </section>
      <PaymentHistory payments={subscription?.payments} plans={plans} />
    </>
  );
}
