create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  endpoint text not null unique check (char_length(endpoint) between 20 and 4096),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth text not null check (char_length(auth) between 8 and 256),
  member_email text check (member_email is null or member_email = lower(btrim(member_email))),
  user_agent text not null default 'Unknown' check (char_length(user_agent) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_active_idx
  on public.push_subscriptions (is_active, updated_at desc);

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on sequence public.push_subscriptions_id_seq from anon, authenticated;
grant all on table public.push_subscriptions to service_role;
grant usage, select on sequence public.push_subscriptions_id_seq to service_role;

comment on table public.push_subscriptions is
  'Server-only Web Push subscriptions for QC team content notifications. Endpoints and encryption keys are sensitive capability data.';
