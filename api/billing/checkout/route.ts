import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/server/auth";
import { billingConfigured, createSubscription, planId, type Currency, type PlanKey } from "@/lib/server/billing";

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  if (!billingConfigured()) return NextResponse.json({ error: "Checkout is not switched on yet." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const plan: PlanKey = body.plan === "yearly" ? "yearly" : "monthly";
  const currency: Currency = body.currency === "USD" ? "USD" : "INR";
  if (!planId(plan, currency)) return NextResponse.json({ error: "Checkout for this region is not open yet." }, { status: 503 });
  try {
    const r = await createSubscription(user.id, plan, currency);
    return NextResponse.json({ ...r, email: user.email, name: user.name });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
