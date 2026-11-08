-- Gridwise: core schema (PRD section 11 data model). Run in the Supabase SQL editor, or with `supabase db push`.
-- Every table has row-level security: a signed-in user can read and write only their own rows.
-- Deleting an auth user cascades to every row below.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  level int not null default 1,
  total_xp int not null default 0,
  placement_module int,
  placement_score int,
  language text not null default 'en',
  role text not null default 'learner' check (role in ('learner', 'trainer')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
-- The browser may change these columns only. `role` is changed by the server.
revoke update on public.profiles from authenticated;
grant update (display_name, language, level, total_xp, placement_module, placement_score) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- learning progress ----------
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  status text not null check (status in ('in_progress', 'completed')),
  attempts int not null default 0,
  hints_used int not null default 0,
  xp_earned int not null default 0,
  revealed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.lesson_progress enable row level security;
create policy "lesson_progress: own" on public.lesson_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,                -- e.g. answer:lesson-id, finish:lesson-id, daily:2026-03-02, shortcut:copy
  event_type text not null check (event_type in ('answer', 'finish', 'daily', 'shortcut')),
  xp int not null,
  lesson_id text,
  created_at timestamptz not null default now(),
  unique (user_id, key)             -- each reward is earned once; makes the guest merge safe to repeat
);
alter table public.xp_events enable row level security;
create policy "xp_events: own" on public.xp_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current int not null default 0,
  longest int not null default 0,
  last_active date,                 -- the learner's local day, not UTC
  freezes_left int not null default 1,
  freeze_week text
);
alter table public.streaks enable row level security;
create policy "streaks: own" on public.streaks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.shortcut_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  shortcut_id text not null,
  attempts int not null default 0,
  avg_ms int not null default 0,
  last_seen timestamptz,
  next_due timestamptz,
  box int not null default 0,
  learned boolean not null default false,
  primary key (user_id, shortcut_id)
);
alter table public.shortcut_stats enable row level security;
create policy "shortcut_stats: own" on public.shortcut_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One row per learner per day. (The PRD lists date, lesson reference and task id; user_id is added so each learner
-- gets a task drawn from lessons they have already learned, and so row-level security can apply.)
create table if not exists public.daily_challenges (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  lesson_id text not null,
  task_id text,
  completed boolean not null default false,
  primary key (user_id, day)
);
alter table public.daily_challenges enable row level security;
create policy "daily_challenges: own" on public.daily_challenges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Job Test Mode (written by the server only, so scores cannot be forged) ----------
create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id text not null,
  seed text not null,               -- the server regenerates the exact tasks from this seed to score them
  time_limit_s int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  answers jsonb,
  score numeric,
  score_by_topic jsonb,
  per_task jsonb
);
alter table public.test_attempts enable row level security;
create policy "test_attempts: read own" on public.test_attempts for select using (auth.uid() = user_id);
-- no insert/update/delete policy: only the service role (server routes) writes here

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  holder_name text not null,
  test_title text not null,
  score numeric not null,
  issued_at timestamptz not null default now(),
  verification_code text not null unique
);
alter table public.certificates enable row level security;
create policy "certificates: read own" on public.certificates for select using (auth.uid() = user_id);
-- public verification goes through the server (/verify/[code]) using the service role, exposing only name, test, score and date

-- ---------- billing (written by webhooks only) ----------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null,                      -- monthly | yearly
  currency text not null default 'INR',
  status text not null check (status in ('none', 'active', 'past_due', 'cancelled', 'expired')),
  processor text not null default 'razorpay',
  processor_customer_id text,
  processor_subscription_id text unique,
  renews_at timestamptz,
  grace_until timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "subscriptions: read own" on public.subscriptions for select using (auth.uid() = user_id);

-- ---------- feedback ----------
create table if not exists public.feedback_reports (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  lesson_id text,
  message text not null check (char_length(message) between 3 and 1000),
  page text,
  browser text,
  created_at timestamptz not null default now()
);
alter table public.feedback_reports enable row level security;
create policy "feedback: anyone may send" on public.feedback_reports for insert with check (user_id is null or auth.uid() = user_id);
create policy "feedback: read own" on public.feedback_reports for select using (auth.uid() = user_id);

-- ---------- weekly lesson quality report (PRD section 14) ----------
-- Completion rate, average attempts and hint rate per lesson. Query it from the SQL editor or a service-role script.
create or replace view public.lesson_quality with (security_invoker = false) as
  select lesson_id,
         count(*) as learners,
         round(avg((status = 'completed')::int)::numeric, 3) as completion_rate,
         round(avg(attempts)::numeric, 2) as avg_attempts,
         round(avg((hints_used > 0)::int)::numeric, 3) as hint_rate,
         (avg((status = 'completed')::int) < 0.7 or avg(attempts) > 3) as needs_rewrite
  from public.lesson_progress
  group by lesson_id;
revoke all on public.lesson_quality from anon, authenticated;
