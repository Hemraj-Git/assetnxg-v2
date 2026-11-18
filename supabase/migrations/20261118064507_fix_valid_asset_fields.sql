-- AssetNXG v2 · fix: the asset-field check let a field without "required"
-- through (a missing value made the test NULL, and NOT NULL is not true).
-- Each field's test is now coalesced to false, and CASE makes sure "is it a
-- list / an object" is decided before anything that needs one (Postgres
-- doesn't promise to evaluate AND / OR left to right). Found by
-- supabase/tests/categories.sql.

create or replace function private.valid_asset_fields(f jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when f is null or jsonb_typeof(f) <> 'array' then false
    when jsonb_array_length(f) > 30 then false
    else
      not exists (
        select 1
        from jsonb_array_elements(f) e
        where case
          when jsonb_typeof(e) <> 'object' then true
          else not coalesce(
            not exists (
              select 1 from jsonb_object_keys(e) k
              where k not in ('key', 'label', 'type', 'unit', 'required')
            )
            and coalesce(e ->> 'key', '') ~ '^[a-z0-9_-]{1,40}$'
            and length(trim(coalesce(e ->> 'label', ''))) between 1 and 60
            and coalesce(e ->> 'type', '') in ('text', 'number', 'date')
            and (
              e -> 'unit' is null
              or jsonb_typeof(e -> 'unit') = 'null'
              or (jsonb_typeof(e -> 'unit') = 'string' and length(e ->> 'unit') <= 20)
            )
            and coalesce(jsonb_typeof(e -> 'required') = 'boolean', false),
            false
          )
        end
      )
      and (select count(distinct e ->> 'key') from jsonb_array_elements(f) e) = jsonb_array_length(f)
      and (select count(distinct lower(trim(e ->> 'label'))) from jsonb_array_elements(f) e) = jsonb_array_length(f)
  end;
$$;
