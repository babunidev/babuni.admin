-- Babuni Admin / Morkahja — Batch A progression and ownership aggregates.
-- REVIEWED SOURCE ARTIFACT, NOT AN AUTOMATIC MIGRATION.
-- This file changes database schema and grants if deliberately executed.
-- Do not run on the live server until the operator has reviewed the source,
-- verified the deployed expansion catalog, and approved this exact change.
-- Run only through an explicitly authorized PostgreSQL administrator.
-- The underlying public tables remain inaccessible to babuni_admin_probe.

BEGIN;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '2s';
SET LOCAL ROLE morkahjadbadmin;

CREATE OR REPLACE VIEW babuni_admin_ro.progression_ownership_totals
WITH (security_barrier = true, security_invoker = false)
AS
WITH achievements AS (
  SELECT
    COUNT(*)::bigint AS achievements_unlocked,
    COUNT(DISTINCT player_id)::bigint AS players_with_achievements
  FROM public.player_achievements
  WHERE rank >= 1
),
player_documents AS (
  SELECT id AS player_id, data
  FROM public.players
),
dice_entries AS (
  SELECT p.player_id, d.item
  FROM player_documents AS p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.data->'unlockedDiceIds') = 'array'
      THEN p.data->'unlockedDiceIds' ELSE '[]'::jsonb END
  ) AS d(item)
),
expansion_entries AS (
  SELECT p.player_id, e.item
  FROM player_documents AS p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.data->'unlockedExpansions') = 'array'
      THEN p.data->'unlockedExpansions' ELSE '[]'::jsonb END
  ) AS e(item)
),
valid_dice AS (
  SELECT DISTINCT player_id, item #>> '{}' AS dice_id
  FROM dice_entries
  WHERE jsonb_typeof(item) = 'string'
    AND item #>> '{}' IN ('b', 'c', 'd', 'e', 'f')
),
valid_expansions AS (
  SELECT DISTINCT player_id, item::text AS expansion_id
  FROM expansion_entries
  WHERE jsonb_typeof(item) = 'number'
    AND item::text IN ('1001', '1002', '1003', '1004')
),
player_quality AS (
  SELECT
    COUNT(*) FILTER (WHERE jsonb_typeof(data) <> 'object')::bigint
      AS invalid_player_documents,
    COUNT(*) FILTER (WHERE data ? 'unlockedDiceIds'
      AND jsonb_typeof(data->'unlockedDiceIds') <> 'array')::bigint
      AS invalid_dice_shapes,
    COUNT(*) FILTER (WHERE data ? 'unlockedExpansions'
      AND jsonb_typeof(data->'unlockedExpansions') <> 'array')::bigint
      AS invalid_expansion_shapes
  FROM player_documents
),
dice_quality AS (
  SELECT COUNT(*) FILTER (
    WHERE jsonb_typeof(item) <> 'string'
      OR item #>> '{}' NOT IN ('a', 'b', 'c', 'd', 'e', 'f')
  )::bigint AS invalid_dice_entries
  FROM dice_entries
),
expansion_quality AS (
  SELECT COUNT(*) FILTER (
    WHERE jsonb_typeof(item) <> 'number'
      OR item::text NOT IN ('0', '1001', '1002', '1003', '1004')
  )::bigint AS invalid_expansion_entries
  FROM expansion_entries
),
dice_counts AS (
  SELECT COUNT(*)::bigint AS dice_unlocks FROM valid_dice
),
expansion_counts AS (
  SELECT COUNT(*)::bigint AS expansion_unlocks FROM valid_expansions
)
SELECT
  a.achievements_unlocked,
  a.players_with_achievements,
  CASE WHEN q.invalid_player_documents > 0
    OR q.invalid_dice_shapes > 0 OR dq.invalid_dice_entries > 0
    THEN NULL::bigint ELSE dc.dice_unlocks END AS dice_unlocks,
  CASE WHEN q.invalid_player_documents > 0
    OR q.invalid_expansion_shapes > 0 OR eq.invalid_expansion_entries > 0
    THEN NULL::bigint ELSE ec.expansion_unlocks END AS expansion_unlocks,
  q.invalid_player_documents,
  q.invalid_dice_shapes,
  dq.invalid_dice_entries,
  q.invalid_expansion_shapes,
  eq.invalid_expansion_entries
FROM achievements AS a
CROSS JOIN player_quality AS q
CROSS JOIN dice_quality AS dq
CROSS JOIN expansion_quality AS eq
CROSS JOIN dice_counts AS dc
CROSS JOIN expansion_counts AS ec;

-- Deliberately grant SELECT on the new aggregate view, never on a raw table.
REVOKE ALL ON babuni_admin_ro.progression_ownership_totals FROM PUBLIC;
GRANT SELECT ON babuni_admin_ro.progression_ownership_totals TO babuni_admin_probe;

COMMIT;
