with reviewed_aliases(alias_name, canonical_name) as (
  values
    ('Amaechi Basil', 'Amaechi Basil Chituru'),
    ('Andrew Desmond', 'Andrew Desmond Onogu'),
    ('Bitrus kwajaffa Esther', 'Bitrus kwajaffa Esther Kwajaffa'),
    ('Chukwuemeka Stephen Nwankwo', 'Nwankwo Stephen Chukwuemeka'),
    ('Damilola uche', 'Odubanjo Damilola Uche Lynda'),
    ('Damilola Uche Lynda', 'Odubanjo Damilola Uche Lynda'),
    ('DANIEL YAASON YUSUF', 'DANIEL YUSUF YAASON'),
    ('Divine Chinyelu Ugwu', 'Ugwu Divine Chinyelu'),
    ('Eboh Ada', 'Eboh Ada Vivian'),
    ('Eniola Kehinde', 'Kehinde Eniola Oluwaseun'),
    ('Esther kwajaffa', 'Bitrus kwajaffa Esther Kwajaffa'),
    ('Godiya Amanda', 'Gwatau Godiya Amanda'),
    ('IGBOEKWE CHUKWUNONSO', 'IGBOEKWE CHUKWUNONSO ONYEDIKA'),
    ('Iloh Ifenyinwa', 'Iloh Ifenyinwa modester'),
    ('Jennifer Enebong', 'Enebong JENNIFER Patience'),
    ('John Emmanuel', 'John Emmanuel Sunday'),
    ('Joshua Agusa', 'Agusa Joshua .'),
    ('Martha Ogbole', 'Ogbole Martha O.'),
    ('Micheal Ogechukwu', 'Micheal Ogechukwu Rose'),
    ('momoh jennifer', 'Momoh Jennifer Ejura'),
    ('Ndukwe Jennifer', 'Ndukwe Jennifer Chiamaka'),
    ('Obasi Julia', 'Obasi Julia Chinwe'),
    ('Obieze Ikenna', 'Obieze Ikenna Arthur'),
    ('OKECHUKWU LAURA', 'OKECHUKWU LAURA TOCHI'),
    ('Okereafor Chukwuemeka', 'Okereafor, PhD Chukwuemeka'),
    ('Okoro Chioma Nina', 'Okoro Okoro Nina chioma'),
    ('Olofu Racheal', 'Olofu Racheal Ene'),
    ('Omeke Nnenna', 'Omeke Nnenna Gladys'),
    ('Queen Juliet', 'ONWUSOROM QUEEN JULIET'),
    ('Ranti Olawoye', 'OLAWOYE RANTI Jemimah'),
    ('Raphben  Joshua', 'Raphben Joshua Chukwuemeka'),
    ('Ufudo Ginika', 'Ufudo Ginika Veronica'),
    ('UKWUOZOR TESSY', 'UKWUOZOR TESSY OKWUCHI'),
    ('Umoh Ikemesit', 'Umoh Ikemesit Edet'),
    ('Unyime udoette', 'Udoette Unyime Ubong'),
    ('Victor Obinna', 'Udebiuwa Victor Obinna'),
    ('Vivian Itelima', 'Itelima Vivian Chigozirim')
)
insert into public.attendance_name_aliases (alias_key, canonical_name)
select public.qcu_attendance_name_key(alias_name), canonical_name
from reviewed_aliases
on conflict (alias_key) do update
set canonical_name = excluded.canonical_name,
    updated_at = now();

update public.attendance_records record
set member_name = alias.canonical_name
from public.attendance_name_aliases alias
where alias.alias_key = public.qcu_attendance_name_key(record.member_name)
  and record.member_name is distinct from alias.canonical_name;
