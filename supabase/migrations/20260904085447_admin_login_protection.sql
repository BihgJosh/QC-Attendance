create table if not exists public.admin_login_attempts (
  client_key text primary key,
  failure_count integer not null default 0 check (failure_count >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_login_attempts enable row level security;
revoke all on table public.admin_login_attempts from anon, authenticated;
grant all on table public.admin_login_attempts to service_role;

create or replace function public.qcu_check_admin_login_attempt(p_client_key text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_row public.admin_login_attempts%rowtype;
begin
  select * into current_row from public.admin_login_attempts where client_key = p_client_key;
  if current_row.locked_until is not null and current_row.locked_until > now() then
    return jsonb_build_object('allowed', false, 'locked_until', current_row.locked_until);
  end if;
  return jsonb_build_object('allowed', true, 'locked_until', null);
end;
$$;

create or replace function public.qcu_record_admin_login_attempt(p_client_key text, p_succeeded boolean, p_maximum_failures integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_row public.admin_login_attempts%rowtype;
  next_failures integer;
  next_lock timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_client_key));
  if p_maximum_failures < 5 or p_maximum_failures > 100 then
    raise exception 'Invalid maximum failure count';
  end if;
  select * into current_row from public.admin_login_attempts where client_key = p_client_key for update;
  if current_row.locked_until is not null and current_row.locked_until > now() then
    return jsonb_build_object('allowed', false, 'attempts_remaining', 0, 'locked_until', current_row.locked_until);
  end if;
  if p_succeeded then
    delete from public.admin_login_attempts where client_key = p_client_key;
    return jsonb_build_object('allowed', true, 'attempts_remaining', 5, 'locked_until', null);
  end if;

  if current_row.client_key is null or current_row.window_started_at < now() - interval '15 minutes' then
    next_failures := 1;
  else
    next_failures := current_row.failure_count + 1;
  end if;
  next_lock := case when next_failures >= p_maximum_failures then now() + interval '15 minutes' else null end;

  insert into public.admin_login_attempts (client_key, failure_count, window_started_at, locked_until, updated_at)
  values (p_client_key, case when next_lock is null then next_failures else 0 end, now(), next_lock, now())
  on conflict (client_key) do update set
    failure_count = excluded.failure_count,
    window_started_at = case
      when admin_login_attempts.window_started_at < now() - interval '15 minutes' or excluded.locked_until is not null then now()
      else admin_login_attempts.window_started_at
    end,
    locked_until = excluded.locked_until,
    updated_at = now();

  return jsonb_build_object(
    'allowed', next_lock is null,
    'attempts_remaining', greatest(0, p_maximum_failures - next_failures),
    'locked_until', next_lock
  );
end;
$$;

revoke all on function public.qcu_check_admin_login_attempt(text) from public, anon, authenticated;
revoke all on function public.qcu_record_admin_login_attempt(text, boolean, integer) from public, anon, authenticated;
grant execute on function public.qcu_check_admin_login_attempt(text) to service_role;
grant execute on function public.qcu_record_admin_login_attempt(text, boolean, integer) to service_role;

comment on table public.admin_login_attempts is
  'Server-only durable throttling state for the legacy administrator login.';

;
