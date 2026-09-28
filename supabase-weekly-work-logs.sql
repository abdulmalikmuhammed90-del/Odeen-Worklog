create table if not exists public.weekly_work_logs (
  week_start date primary key,
  summary text not null check (char_length(trim(summary)) between 1 and 5000),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table public.weekly_work_logs enable row level security;

grant select, insert, update on public.weekly_work_logs to authenticated;

drop policy if exists "Managers can read weekly work logs" on public.weekly_work_logs;
create policy "Managers can read weekly work logs"
  on public.weekly_work_logs for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and lower(profiles.role) = 'manager'
    )
  );

drop policy if exists "Managers can add weekly work logs" on public.weekly_work_logs;
create policy "Managers can add weekly work logs"
  on public.weekly_work_logs for insert to authenticated
  with check (
    updated_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and lower(profiles.role) = 'manager'
    )
  );

drop policy if exists "Managers can update weekly work logs" on public.weekly_work_logs;
create policy "Managers can update weekly work logs"
  on public.weekly_work_logs for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and lower(profiles.role) = 'manager'
    )
  )
  with check (
    updated_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and lower(profiles.role) = 'manager'
    )
  );