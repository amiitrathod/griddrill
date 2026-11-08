import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/server/auth";
import { getSubscription, verifySignature } from "@/lib/server/billing";
import { applySubscriptionEvent } from "@/lib/billing-events";

/**
 * Called by the browser right after Razorpay Checkout succeeds. It verifies the signed callback so Pro turns on at once;
 * the webhook remains the source of truth and will overwrite this with the same facts.
 */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  const admin = adminClient();
  if (!user || !admin) return NextResponse.json({ ok: false }, { status: 401 });
  const { razorpay_payment_id: pay, razorpay_subscription_id: subId, razorpay_signature: sig } = await req.json().catch(() => ({}));
  if (!pay || !subId || !verifySignature(`${pay}|${subId}`, sig ?? "", process.env.RAZORPAY_KEY_SECRET ?? "")) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    const sub = await getSubscription(subId);
    if (sub.notes?.user_id !== user.id) return NextResponse.json({ ok: false }, { status: 403 });
    const row = applySubscriptionEvent({ event: "subscription.activated", payload: { subscription: { entity: { id: subId, current_end: sub.current_end } } } }, null)!;
    await admin.from("subscriptions").upsert({ user_id: user.id, plan: sub.notes?.plan ?? "monthly", currency: sub.notes?.currency ?? "INR", processor: "razorpay", processor_subscription_id: subId, ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[verify]", e);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
