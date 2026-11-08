import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/server/auth";

export async function POST(req: Request) {
  let body: { lessonId?: string; message?: string; page?: string; browser?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const message = (body.message ?? "").toString().trim().slice(0, 1000);
  if (message.length < 3) return NextResponse.json({ ok: false }, { status: 400 });
  const user = await userFromRequest(req);
  const row = { user_id: user?.id ?? null, lesson_id: body.lessonId ?? null, message, page: (body.page ?? "").slice(0, 200), browser: (body.browser ?? "").slice(0, 200) };
  const admin = adminClient();
  if (!admin) {
    console.log("[feedback]", JSON.stringify(row)); // dev mode: no database configured
    return NextResponse.json({ ok: true });
  }
  const { error } = await admin.from("feedback_reports").insert(row);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
