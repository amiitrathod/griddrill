import crypto from "node:crypto";
import { adminClient } from "./auth";
import { isPro } from "../entitlements";
import { PAYWALL_ENABLED } from "../config";

export type Attempt = { id: string; user_id: string; test_id: string; seed: string; time_limit_s: number; started_at: string; finished_at: string | null; score: number | null };
export type Cert = { id: string; user_id: string; test_attempt_id: string; holder_name: string; test_title: string; score: number; issued_at: string; verification_code: string };

// Development without Supabase keeps everything in memory so the whole flow can be tried locally. Never used in production.
const g = globalThis as unknown as { __gw?: { attempts: Map<string, Attempt>; certs: Map<string, Cert> } };
const mem = (g.__gw ??= { attempts: new Map(), certs: new Map() });

export function newCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  const s = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `GW-${s.slice(0, 5)}-${s.slice(5)}`;
}

export async function userIsPro(userId: string): Promise<boolean> {
  if (!PAYWALL_ENABLED) return true;
  const admin = adminClient();
  if (!admin) return process.env.NODE_ENV !== "production";
  const { data } = await admin.from("subscriptions").select("status, renews_at, grace_until").eq("user_id", userId).maybeSingle();
  return data ? isPro({ status: data.status, renewsAt: data.renews_at, graceUntil: data.grace_until }) : false;
}

export async function createAttempt(a: Omit<Attempt, "id" | "finished_at" | "score" | "started_at">): Promise<Attempt> {
  const admin = adminClient();
  if (!admin) {
    const row: Attempt = { ...a, id: crypto.randomUUID(), started_at: new Date().toISOString(), finished_at: null, score: null };
    mem.attempts.set(row.id, row);
    return row;
  }
  const { data, error } = await admin.from("test_attempts").insert(a).select("id, user_id, test_id, seed, time_limit_s, started_at, finished_at, score").single();
  if (error) throw error;
  return data as Attempt;
}

export async function getAttempt(id: string): Promise<Attempt | null> {
  const admin = adminClient();
  if (!admin) return mem.attempts.get(id) ?? null;
  const { data } = await admin.from("test_attempts").select("id, user_id, test_id, seed, time_limit_s, started_at, finished_at, score").eq("id", id).maybeSingle();
  return (data as Attempt) ?? null;
}

export async function finishAttempt(id: string, fields: { answers: unknown; score: number; score_by_topic: unknown; per_task: unknown }): Promise<void> {
  const admin = adminClient();
  const finished_at = new Date().toISOString();
  if (!admin) {
    const a = mem.attempts.get(id);
    if (a) mem.attempts.set(id, { ...a, finished_at, score: fields.score });
    return;
  }
  const { error } = await admin.from("test_attempts").update({ ...fields, finished_at }).eq("id", id).is("finished_at", null);
  if (error) throw error;
}

export async function createCertificate(c: Omit<Cert, "id" | "issued_at" | "verification_code">): Promise<Cert> {
  const row = { ...c, verification_code: newCode() };
  const admin = adminClient();
  if (!admin) {
    const full: Cert = { ...row, id: crypto.randomUUID(), issued_at: new Date().toISOString() };
    mem.certs.set(full.verification_code, full);
    return full;
  }
  const { data, error } = await admin.from("certificates").insert(row).select("*").single();
  if (error) throw error;
  return data as Cert;
}

export async function getCertificate(code: string): Promise<Cert | null> {
  const admin = adminClient();
  if (!admin) return mem.certs.get(code) ?? null;
  const { data } = await admin.from("certificates").select("*").eq("verification_code", code).maybeSingle();
  return (data as Cert) ?? null;
}

export async function certificateForAttempt(attemptId: string): Promise<Cert | null> {
  const admin = adminClient();
  if (!admin) return [...mem.certs.values()].find((c) => c.test_attempt_id === attemptId) ?? null;
  const { data } = await admin.from("certificates").select("*").eq("test_attempt_id", attemptId).maybeSingle();
  return (data as Cert) ?? null;
}
