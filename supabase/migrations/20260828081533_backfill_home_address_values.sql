update public."Team Data"
set "Address" = btrim("Home Address")
where nullif(btrim("Address"), '') is null
  and nullif(btrim("Home Address"), '') is not null;

comment on column public."Team Data"."Address" is
  'Member residential address. Initially backfilled from Home Address, then maintained through the member profile flow.';
