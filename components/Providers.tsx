"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { clearGuest, loadGuest, loadUserCache, saveGuest, saveUserCache } from "@/lib/progress/storage";
import { loadRemote, pushRemote } from "@/lib/progress/remote";
import {
  completeDaily as lCompleteDaily, completeLesson as lCompleteLesson, emptyProgress, mergeProgress, recordAttempt as lAttempt,
  recordHint as lHint, recordReveal as lReveal, recordShortcut as lShortcut, totalXp, type ProgressState,
} from "@/lib/progress/logic";
import { isPro, type Sub } from "@/lib/entitlements";
import { PAYWALL_ENABLED } from "@/lib/config";
import { installGlobalErrorHandlers, reportError } from "@/lib/errors";
import { setSignedIn, track } from "@/lib/analytics";

export type AppUser = { id: string; email: string; name: string };

type AuthCtx = {
  configured: boolean;
  loading: boolean;
  user: AppUser | null;
  sub: Sub | null;
  pro: boolean;
  role: "learner" | "trainer";
  getToken: () => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
  refreshSub: () => Promise<void>;
};

type ProgressCtx = {
  state: ProgressState;
  ready: boolean;
  xp: number;
  attempt: (lessonId: string) => void;
  hint: (lessonId: string) => void;
  reveal: (lessonId: string) => void;
  complete: (lessonId: string, baseXp: number) => number;
  completeDaily: (day: string, lessonId: string) => number;
  shortcut: (id: string, correct: boolean, ms: number) => number;
  setPlacement: (startModule: number, score: number) => void;
};

const Auth = createContext<AuthCtx | null>(null);
const Progress = createContext<ProgressCtx | null>(null);
export const useAuth = () => {
  const c = useContext(Auth);
  if (!c) throw new Error("AuthProvider missing");
  return c;
};
export const useProgress = () => {
  const c = useContext(Progress);
  if (!c) throw new Error("ProgressProvider missing");
  return c;
};

function toUser(s: Session | null): AppUser | null {
  if (!s) return null;
  const u = s.user;
  return { id: u.id, email: u.email ?? "", name: (u.user_metadata?.display_name as string) || (u.user_metadata?.full_name as string) || (u.email ?? "").split("@")[0] };
}

export function Providers({ children }: { children: ReactNode }) {
  const sb = getSupabase();
  const [loading, setLoading] = useState(supabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [role, setRole] = useState<"learner" | "trainer">("learner");
  const [state, setState] = useState<ProgressState>(emptyProgress());
  const [ready, setReady] = useState(false);
  const user = useMemo(() => toUser(session), [session]);
  const lastSynced = useRef<ProgressState | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  // ---- auth session ----
  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = sb.auth.onAuthStateChange((evt, s) => {
      if (evt === "SIGNED_IN" || evt === "TOKEN_REFRESHED" || evt === "SIGNED_OUT" || evt === "USER_UPDATED") setSession(s);
      if (evt === "SIGNED_OUT") setSession(null);
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => setSignedIn(!!user), [user]);

  // ---- progress: guest on this device, or the account with the guest progress merged in ----
  const uid = user?.id ?? null;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      if (!uid || !sb) {
        const g = loadGuest() ?? emptyProgress();
        if (!cancelled) {
          setState(g);
          lastSynced.current = null;
          setReady(true);
        }
        return;
      }
      try {
        const guest = loadGuest();
        const remote = await loadRemote(sb, uid);
        const cached = loadUserCache(uid);
        let merged = cached ? mergeProgress(remote, cached) : remote;
        const hadGuest = !!guest && (Object.keys(guest.lessons).length > 0 || guest.events.length > 0);
        if (hadGuest) {
          merged = mergeProgress(merged, guest!);
          track("signup_completed");
        }
        await pushRemote(sb, uid, remote, merged);
        if (hadGuest) clearGuest();
        saveUserCache(uid, merged);
        if (!cancelled) {
          lastSynced.current = merged;
          setState(merged);
        }
      } catch (e) {
        reportError(e, { where: "progress-load" });
        const cached = loadUserCache(uid);
        if (!cancelled) setState(cached ?? loadGuest() ?? emptyProgress());
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, sb]);

  // ---- profile role and subscription ----
  const refreshSub = useCallback(async () => {
    if (!sb || !uid) {
      setSub(null);
      return;
    }
    const [s, p] = await Promise.all([
      sb.from("subscriptions").select("status, renews_at, grace_until").eq("user_id", uid).maybeSingle(),
      sb.from("profiles").select("role").eq("id", uid).maybeSingle(),
    ]);
    setSub(s.data ? { status: s.data.status, renewsAt: s.data.renews_at, graceUntil: s.data.grace_until } : null);
    setRole(p.data?.role === "trainer" ? "trainer" : "learner");
  }, [sb, uid]);
  useEffect(() => {
    refreshSub();
  }, [refreshSub]);

  const persist = useCallback(
    (next: ProgressState) => {
      setState(next);
      if (uid && sb) {
        saveUserCache(uid, next);
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => {
          const prev = lastSynced.current;
          pushRemote(sb, uid, prev, stateRef.current)
            .then(() => (lastSynced.current = stateRef.current))
            .catch((e) => reportError(e, { where: "progress-sync" }));
        }, 700);
      } else saveGuest(next);
    },
    [sb, uid]
  );

  const progress = useMemo<ProgressCtx>(
    () => ({
      state,
      ready,
      xp: totalXp(state),
      attempt: (id) => persist(lAttempt(stateRef.current, id)),
      hint: (id) => persist(lHint(stateRef.current, id)),
      reveal: (id) => persist(lReveal(stateRef.current, id)),
      complete: (id, base) => {
        const before = stateRef.current.streak.current;
        const r = lCompleteLesson(stateRef.current, id, base);
        if (!r.alreadyDone) {
          persist(r.state);
          if (r.state.streak.current > before) track("streak_extended");
        }
        return r.xpGained;
      },
      completeDaily: (day, id) => {
        const r = lCompleteDaily(stateRef.current, day, id);
        if (r.xpGained) persist(r.state);
        return r.xpGained;
      },
      shortcut: (id, correct, ms) => {
        const r = lShortcut(stateRef.current, id, correct, ms);
        persist(r.state);
        return r.xpGained;
      },
      setPlacement: (startModule, score) => persist({ ...stateRef.current, placement: { startModule, score } }),
    }),
    [state, ready, persist]
  );

  const auth = useMemo<AuthCtx>(
    () => ({
      configured: supabaseConfigured,
      loading,
      user,
      sub,
      pro: !PAYWALL_ENABLED || isPro(sub),
      role,
      getToken: async () => (sb ? (await sb.auth.getSession()).data.session?.access_token ?? null : null),
      signUp: async (email, password, name) => {
        if (!sb) return "Accounts are not set up on this site yet.";
        track("signup_started");
        const { error } = await sb.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/account` } });
        return error ? error.message : null;
      },
      signIn: async (email, password) => {
        if (!sb) return "Accounts are not set up on this site yet.";
        const { error } = await sb.auth.signInWithPassword({ email, password });
        return error ? error.message : null;
      },
      signInGoogle: async () => {
        if (!sb) return "Accounts are not set up on this site yet.";
        track("signup_started", { source: "google" });
        const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/account` } });
        return error ? error.message : null;
      },
      signOut: async () => {
        await sb?.auth.signOut();
        setSession(null);
        setSub(null);
      },
      resetPassword: async (email) => {
        if (!sb) return "Accounts are not set up on this site yet.";
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account/reset` });
        return error ? error.message : null;
      },
      deleteAccount: async () => {
        if (!sb) return "Accounts are not set up on this site yet.";
        const token = (await sb.auth.getSession()).data.session?.access_token;
        const res = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return "Could not delete the account. Please contact us.";
        if (uid) {
          try {
            window.localStorage.removeItem(`gridwise.progress.v1.${uid}`);
          } catch {}
        }
        await sb.auth.signOut();
        setSession(null);
        return null;
      },
      refreshSub,
    }),
    [sb, loading, user, sub, role, refreshSub, uid]
  );

  return (
    <Auth.Provider value={auth}>
      <Progress.Provider value={progress}>{children}</Progress.Provider>
    </Auth.Provider>
  );
}
