import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/server/auth";
import { getSubscription, listInvoices } from "@/lib/server/billing";

export async function GET(req: Request) {
  const user = await userFromRequest(req);
  const admin = adminClient();
  if (!user || !admin) return NextResponse.json({ invoices: [] }, { status: 401 });
  const { data } = await admin.from("subscriptions").select("processor_subscription_id").eq("user_id", user.id).maybeSingle();
  if (!data?.processor_subscription_id) return NextResponse.json({ invoices: [] });
  try {
    const [invoices, sub] = await Promise.all([listInvoices(data.processor_subscription_id), getSubscription(data.processor_subscription_id)]);
    return NextResponse.json({ invoices, manageUrl: sub.short_url });
  } catch (e) {
    console.error("[invoices]", e);
    return NextResponse.json({ invoices: [] }, { status: 502 });
  }
}
