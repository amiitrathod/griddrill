-- Stage 7: classroom tools. A trainer creates a class, shares a join code, assigns modules and sees progress.

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  join_code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create table if not exists public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  module_id text not null,
  assigned_at timestamptz not null default now(),
  unique (class_id, module_id)
);
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_assignments enable row level security;

create policy "classes: trainer manages" on public.classes for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);
create policy "classes: members read" on public.classes for select using (exists (select 1 from public.class_members m where m.class_id = id and m.user_id = auth.uid()));
create policy "members: trainer reads" on public.class_members for select using (exists (select 1 from public.classes c where c.id = class_id and c.trainer_id = auth.uid()));
create policy "members: read own" on public.class_members for select using (auth.uid() = user_id);
create policy "members: leave" on public.class_members for delete using (auth.uid() = user_id);
-- joining goes through /api/classes/join (it checks the code), so there is no insert policy
create policy "assignments: trainer manages" on public.class_assignments for all
  using (exists (select 1 from public.classes c where c.id = class_id and c.trainer_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.trainer_id = auth.uid()));
create policy "assignments: members read" on public.class_assignments for select
  using (exists (select 1 from public.class_members m where m.class_id = class_assignments.class_id and m.user_id = auth.uid()));

-- A trainer may read the progress and display name of learners in their own classes, and nothing else about them.
create policy "lesson_progress: trainer reads class" on public.lesson_progress for select using (
  exists (select 1 from public.class_members m join public.classes c on c.id = m.class_id where m.user_id = lesson_progress.user_id and c.trainer_id = auth.uid()));
create policy "profiles: trainer reads class" on public.profiles for select using (
  exists (select 1 from public.class_members m join public.classes c on c.id = m.class_id where m.user_id = profiles.id and c.trainer_id = auth.uid()));
