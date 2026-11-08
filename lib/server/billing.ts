import crypto from "node:crypto";

/**
 * Razorpay REST calls, without the SDK. Docs: https://razorpay.com/docs/api/payments/subscriptions/
 * Keep a second provider in mind (PRD risk: processor may not accept your business). Everything provider-specific is in this file.
 */
const BASE = "https://api.razorpay.com/v1";

export function billingConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

async function rz<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${JSON.stringify(json?.error ?? json)}`);
  return json as T;
}

export type PlanKey = "monthly" | "yearly";
export type Currency = "INR" | "USD";

export function planId(plan: PlanKey, currency: Currency): string | null {
  return process.env[`RAZORPAY_PLAN_${plan.toUpperCase()}_${currency}`] || null;
}

export async function createSubscription(userId: string, plan: PlanKey, currency: Currency) {
  const id = planId(plan, currency);
  if (!id) throw new Error(`No plan id configured for ${plan} in ${currency}`);
  const sub = await rz<{ id: string; short_url: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({ plan_id: id, total_count: plan === "monthly" ? 120 : 10, customer_notify: 1, notes: { user_id: userId, plan, currency } }),
  });
  return { subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID!, manageUrl: sub.short_url };
}

export async function cancelProviderSubscription(subscriptionId: string, atCycleEnd = true) {
  return rz(`/subscriptions/${subscriptionId}/cancel`, { method: "POST", body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }) });
}

export async function listInvoices(subscriptionId: string) {
  const r = await rz<{ items: { id: string; amount: number; currency: string; status: string; issued_at?: number; paid_at?: number; short_url?: string }[] }>(`/invoices?subscription_id=${encodeURIComponent(subscriptionId)}`);
  return r.items.map((i) => ({ id: i.id, amount: i.amount / 100, currency: i.currency, status: i.status, at: i.paid_at ?? i.issued_at ?? null, url: i.short_url ?? null }));
}

export async function getSubscription(subscriptionId: string) {
  return rz<{ id: string; status: string; current_end: number | null; short_url: string; notes: Record<string, string> }>(`/subscriptions/${subscriptionId}`);
}

/** Constant-time HMAC check used for both webhooks and the checkout-success callback. */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
