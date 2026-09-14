alter table public.attendance_settings
  add column if not exists closes_at timestamptz;

comment on column public.attendance_settings.closes_at is
  'Optional UTC instant when an open attendance window automatically becomes closed.';;
