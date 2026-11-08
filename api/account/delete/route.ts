import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/server/auth";
import { cancelProviderSubscription } from "@/lib/server/billing";

/** Deletes the auth user; every table references auth.users with ON DELETE CASCADE, so all rows go with it. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  const admin = adminClient();
  if (!user || !admin) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { data } = await admin.from("subscriptions").select("processor_subscription_id, status").eq("user_id", user.id).maybeSingle();
    if (data?.processor_subscription_id && ["active", "past_due"].includes(data.status)) await cancelProviderSubscription(data.processor_subscription_id, false);
  } catch (e) {
    console.error("[delete-account] could not cancel subscription", e); // continue: the learner asked to delete
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
