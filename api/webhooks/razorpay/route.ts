import { NextResponse } from "next/server";
import { adminClient } from "@/lib/server/auth";
import { verifySignature } from "@/lib/server/billing";
import { applySubscriptionEvent, type RzEvent } from "@/lib/billing-events";

export const dynamic = "force-dynamic";

/** Razorpay -> Settings -> Webhooks. URL: https://YOUR-SITE/api/webhooks/razorpay. Events: all `subscription.*`. */
export async function POST(req: Request) {
  const raw = await req.text(); // the signature covers the exact raw body
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!verifySignature(raw, req.headers.get("x-razorpay-signature") ?? "", secret)) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });

  let ev: RzEvent;
  try {
    ev = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ent = ev.payload?.subscription?.entity;
  if (!ent?.id) return NextResponse.json({ ok: true }); // payment-only events carry nothing we store

  const { data: existing } = await admin.from("subscriptions").select("*").eq("processor_subscription_id", ent.id).maybeSingle();
  const userId = existing?.user_id ?? ent.notes?.user_id;
  if (!userId) return NextResponse.json({ ok: true }); // not ours
  const next = applySubscriptionEvent(ev, existing ?? null);
  if (!next) return NextResponse.json({ ok: true });

  const { error } = await admin.from("subscriptions").upsert(
    { user_id: userId, plan: existing?.plan ?? ent.notes?.plan ?? "monthly", currency: existing?.currency ?? ent.notes?.currency ?? "INR", processor: "razorpay", processor_subscription_id: ent.id, ...next, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("[webhook] could not store", error);
    return NextResponse.json({ ok: false }, { status: 500 }); // non-2xx makes Razorpay retry
  }
  if (ev.event === "subscription.activated") console.log(JSON.stringify({ evt: "subscription_started", plan: ent.notes?.plan }));
  if (ev.event === "subscription.cancelled") console.log(JSON.stringify({ evt: "subscription_cancelled" }));
  return NextResponse.json({ ok: true });
}
