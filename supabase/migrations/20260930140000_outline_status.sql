-- Course status on outlines: C = compulsory, E = elective. Null until set.
alter table public.outlines
  add column if not exists status text check (status in ('C', 'E'));

update public.outlines set status = 'E'
where id in ('mme-416', 'mme-521', 'mme-525', 'mme-526', 'ssg-522');

update public.outlines set status = 'C'
where level in (400, 500) and status is null;
