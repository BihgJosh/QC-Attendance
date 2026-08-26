alter table public."Team Data"
rename column "QC Join Date" to "Church Join Year";

alter table public."Team Data"
alter column "Church Join Year" type integer
using extract(year from "Church Join Year")::integer;

alter table public."Team Data"
add constraint team_data_church_join_year_four_digits
check ("Church Join Year" is null or "Church Join Year" between 1900 and 9999);

comment on column public."Team Data"."Church Join Year" is
  'Four-digit year the member joined the church. Required through the member profile flow; nullable only for legacy rows.';
