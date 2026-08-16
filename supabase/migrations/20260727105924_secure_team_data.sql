alter table public."Team Data" add column if not exists normalized_email text generated always as (lower(btrim("Email"))) stored;
alter table public."Team Data" drop constraint if exists team_data_email_not_blank;
alter table public."Team Data" add constraint team_data_email_not_blank check (normalized_email <> '');
create unique index if not exists team_data_normalized_email_key on public."Team Data" (normalized_email);
alter table public."Team Data" enable row level security;
revoke all on table public."Team Data" from anon, authenticated;
grant all on table public."Team Data" to service_role;;
