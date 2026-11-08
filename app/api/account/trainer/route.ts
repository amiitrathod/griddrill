import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/server/auth";

/** Turns on trainer tools for the signed-in user. Done on the server because `role` is not writable from the browser. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  const admin = adminClient();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!admin) return NextResponse.json({ ok: true, dev: true });
  const { error } = await admin.from("profiles").update({ role: "trainer" }).eq("id", user.id);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
