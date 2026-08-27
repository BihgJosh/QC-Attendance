alter table public."Team Data"
add column if not exists "Address" text;

alter table public."Team Data"
add constraint team_data_address_length
check ("Address" is null or char_length(btrim("Address")) between 1 and 300);

comment on column public."Team Data"."Address" is
  'Member residential address collected through the profile flow; nullable only for legacy rows until each member completes the new question.';
