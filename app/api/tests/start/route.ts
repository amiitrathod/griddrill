import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { userFromRequest } from "@/lib/server/auth";
import { createAttempt, userIsPro } from "@/lib/server/tests-store";
import { generateTest, getTemplate, toPublic } from "@/lib/jobtest";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Please log in to take a test." }, { status: 401 });
  const { testId } = await req.json().catch(() => ({}));
  const t = typeof testId === "string" ? getTemplate(testId) : undefined;
  if (!t) return NextResponse.json({ error: "Unknown test." }, { status: 404 });
  if (t.proOnly && !(await userIsPro(user.id))) return NextResponse.json({ error: "This test is part of Pro." }, { status: 402 });
  const seed = crypto.randomBytes(8).toString("hex"); // fresh data on every attempt, so answers cannot be shared
  const attempt = await createAttempt({ user_id: user.id, test_id: t.id, seed, time_limit_s: t.minutes * 60 });
  return NextResponse.json({
    attemptId: attempt.id,
    title: t.title,
    timeLimitSeconds: attempt.time_limit_s,
    startedAt: attempt.started_at,
    tasks: toPublic(generateTest(t.id, seed)),
  });
}
