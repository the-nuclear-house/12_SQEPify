-- EXTRACTION_QUERIES.sql
-- Run each query in the Supabase SQL editor and save the result with the editor's
-- Download CSV button (not by copying the cell, which can be truncated). Each query
-- returns a single row of text so the editor's row limit cannot cut it off.
-- Hand the results to whoever rebuilds SCHEMA_BASELINE.sql.

-- 1. Tables and columns (public schema)
select string_agg(line, E'\n' order by line) as schema_columns
from (
  select format(
    '%s.%s : %s %s%s',
    table_name, column_name, data_type,
    case when is_nullable = 'NO' then 'NOT NULL' else 'NULL' end,
    case when column_default is not null then ' DEFAULT ' || column_default else '' end
  ) as line
  from information_schema.columns
  where table_schema = 'public'
) t;

-- 2. Constraints (primary keys, uniques, checks, foreign keys)
select string_agg(line, E'\n' order by line) as constraints
from (
  select format('%s : %s (%s)', tc.table_name, tc.constraint_type, tc.constraint_name) as line
  from information_schema.table_constraints tc
  where tc.table_schema = 'public'
) t;

-- 3. Indexes
select string_agg(indexdef, E'\n' order by indexdef) as indexes
from pg_indexes
where schemaname = 'public';

-- 4. Row Level Security policies
select string_agg(line, E'\n' order by line) as policies
from (
  select format(
    'TABLE %s | POLICY %s | %s | roles=%s | USING(%s) | CHECK(%s)',
    tablename, policyname, cmd, array_to_string(roles, ','),
    coalesce(qual, ''), coalesce(with_check, '')
  ) as line
  from pg_policies
  where schemaname = 'public'
) t;

-- 5. Which tables have RLS enabled
select string_agg(format('%s : rls=%s', relname, relrowsecurity::text), E'\n' order by relname) as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';

-- 6. Functions and their definitions
select string_agg(pg_get_functiondef(p.oid), E'\n\n' order by p.proname) as functions
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
