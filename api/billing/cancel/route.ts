import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/server/auth";
import { cancelProviderSubscription } from "@/lib/server/billing";

/** Cancels at the end of the paid period. Pro keeps working until then. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  const admin = adminClient();
  if (!user || !admin) return NextResponse.json({ ok: false }, { status: 401 });
  const { data } = await admin.from("subscriptions").select("processor_subscription_id, status").eq("user_id", user.id).maybeSingle();
  if (!data?.processor_subscription_id) return NextResponse.json({ ok: false, error: "No active plan." }, { status: 404 });
  try {
    await cancelProviderSubscription(data.processor_subscription_id, true);
    // the webhook updates the row; mark it now so the page is right immediately
    await admin.from("subscriptions").update({ cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cancel]", e);
    return NextResponse.json({ ok: false, error: "Could not cancel. Please contact us." }, { status: 502 });
  }
}
