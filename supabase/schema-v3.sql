-- Run after schema-v2.sql
-- Adds dietary_options array; keeps on_glp1 for backward compatibility
alter table profiles add column if not exists dietary_options text[] default '{}';
