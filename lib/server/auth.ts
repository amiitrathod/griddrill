import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role client for server routes only. Never import this in client components. */
export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type ServerUser = { id: string; email: string | null; name: string | null };

/** Resolve the signed-in user from the Authorization: Bearer <access token> header. */
export async function userFromRequest(req: Request): Promise<ServerUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const admin = adminClient();
  if (!admin) {
    // Development without Supabase: a fixed local user so the whole flow can be tried. Never active in production.
    if (process.env.NODE_ENV !== "production") return { id: "dev-user", email: "dev@example.com", name: "Dev Learner" };
    return null;
  }
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null, name: (data.user.user_metadata?.display_name as string) ?? null };
}
