-- Morkahja Overview candidate-metric schema audit, metadata only.
-- Run as the operator on the Ubuntu server, never through Babuni Admin.
-- No game rows, JSON payloads, player identities, credentials or payments are selected.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '2s';

SELECT
  c.relname AS relation,
  CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view'
    WHEN 'p' THEN 'partitioned table' ELSE c.relkind::text END AS kind,
  pg_get_userbyid(c.relowner) AS owner,
  has_table_privilege('babuni_admin_probe', c.oid, 'SELECT') AS probe_can_select,
  has_any_column_privilege('babuni_admin_probe', c.oid, 'SELECT') AS probe_can_select_any_column
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE (n.nspname = 'public' AND c.relname IN (
  'players', 'encounter_rooms', 'player_presence', 'player_achievements',
  'purchases', 'processed_stripe_events', 'game_events', 'sessions'
))
OR (n.nspname = 'babuni_admin_ro' AND c.relname IN ('overview','player_preview'))
ORDER BY n.nspname, c.relname;

SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE (table_schema = 'public' AND table_name IN (
  'players', 'encounter_rooms', 'player_presence', 'player_achievements',
  'purchases', 'processed_stripe_events', 'game_events'
))
OR (table_schema = 'babuni_admin_ro' AND table_name IN ('overview','player_preview'))
ORDER BY table_schema, table_name, ordinal_position;

ROLLBACK;
