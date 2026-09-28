create table if not exists public.weekly_client_orders (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  client_name text not null check (char_length(trim(client_name)) between 1 and 160),
  order_count integer not null check (order_count > 0),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint weekly_client_orders_week_client_key unique (week_start, client_name)
);

alter table public.weekly_client_orders enable row level security;

grant select, insert, update, delete on public.weekly_client_orders to authenticated;

drop policy if exists "Managers can read weekly client orders" on public.weekly_client_orders;
create policy "Managers can read weekly client orders"
  on public.weekly_client_orders for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and lower(profiles.role) = 'manager'
    )
  );

drop policy if exists "Managers can add weekly client orders" on public.weekly_client_orders;
create policy "Managers can add weekly client orders"
  on public.weekly_client_orders for insert to authenticated
  with check (
    updated_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and lower(profiles.role) = 'manager'
    )
  );

drop policy if exists "Managers can update weekly client orders" on public.weekly_client_orders;
create policy "Managers can update weekly client orders"
  on public.weekly_client_orders for update to authenticated
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

drop policy if exists "Managers can delete weekly client orders" on public.weekly_client_orders;
create policy "Managers can delete weekly client orders"
  on public.weekly_client_orders for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and lower(profiles.role) = 'manager'
    )
  );