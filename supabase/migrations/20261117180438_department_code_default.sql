-- The department number (DEP-0001) is always set by the insert trigger, and
-- the API may not send it (no insert grant on code). A default makes that
-- visible in the generated types (Insert.code optional). The trigger
-- overwrites it on every insert.
alter table public.departments alter column code set default '';
