import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/server/auth";
import { certificateForAttempt, createCertificate, finishAttempt, getAttempt, userIsPro } from "@/lib/server/tests-store";
import { generateTest, getTemplate, scoreTest } from "@/lib/jobtest";

export const dynamic = "force-dynamic";
const PASS_PERCENT = 60; // certificate needs at least this score
const GRACE_SECONDS = 30; // network time allowance on top of the limit

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const attempt = typeof body.attemptId === "string" ? await getAttempt(body.attemptId) : null;
  if (!attempt || attempt.user_id !== user.id) return NextResponse.json({ error: "Test not found." }, { status: 404 });
  if (attempt.finished_at) return NextResponse.json({ error: "This test was already submitted." }, { status: 409 });
  const t = getTemplate(attempt.test_id)!;

  const elapsed = Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
  const late = elapsed > attempt.time_limit_s + GRACE_SECONDS;
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.answers ?? {})) if (typeof v === "string") answers[k] = v;

  // Scoring always runs here, on tasks rebuilt from the stored seed. The browser never sees an expected value.
  const tasks = generateTest(attempt.test_id, attempt.seed);
  const result = scoreTest(tasks, late ? {} : answers);

  await finishAttempt(attempt.id, { answers, score: result.percent, score_by_topic: result.byTopic, per_task: result.perTask });

  let certificate: { code: string } | null = null;
  if (!late && result.percent >= PASS_PERCENT && t.proOnly && (await userIsPro(user.id))) {
    let holder = String(body.holderName ?? "").trim().slice(0, 60);
    if (!holder) {
      const admin = adminClient();
      const { data } = admin ? await admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
      holder = data?.display_name || user.name || "Gridwise learner";
    }
    const existing = await certificateForAttempt(attempt.id);
    const cert = existing ?? (await createCertificate({ user_id: user.id, test_attempt_id: attempt.id, holder_name: holder, test_title: t.title, score: result.percent }));
    certificate = { code: cert.verification_code };
  }
  console.log(JSON.stringify({ evt: "test_finished", testId: t.id, score: result.percent, late }));
  return NextResponse.json({ ...result, late, passMark: PASS_PERCENT, elapsedSeconds: elapsed, certificate, title: t.title });
}
