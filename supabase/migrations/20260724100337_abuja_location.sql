alter table public.attendance_settings
  add column if not exists location_name text not null default 'Abuja',
  add column if not exists timezone_label text not null default 'WAT';
update public.attendance_settings
set location_name = 'Abuja',
    timezone_label = 'WAT',
    updated_at = now()
where id = 1;
comment on column public.attendance_settings.location_name is 'Human-facing attendance locality; currently Abuja.';
comment on column public.attendance_settings.timezone_label is 'Human-facing timezone label for Abuja dates; WAT (UTC+1).';;
