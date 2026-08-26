alter table public."Team Data"
add column if not exists "QC Join Date" date;

comment on column public."Team Data"."QC Join Date" is
  'Required through the member profile flow; nullable only for legacy rows until each member completes the new question.';
