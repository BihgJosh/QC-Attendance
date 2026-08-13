alter table public.service_observer_reports
  add column if not exists locations_reported jsonb not null default '[]'::jsonb,
  add column if not exists location_observations jsonb not null default '{}'::jsonb;

comment on column public.service_observer_reports.locations_reported is
  'Locations selected in multi-location observer reports. Legacy reports retain an empty array and use reporting_location.';
comment on column public.service_observer_reports.location_observations is
  'Observation text keyed by reporting location for multi-location observer reports.';
