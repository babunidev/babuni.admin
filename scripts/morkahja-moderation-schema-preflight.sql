-- Metadata-only preflight for the live account-inspection query contract.
-- Execute in the database named by the existing private Overview config.
-- No game/player rows are selected and no database changes are performed.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';

SELECT current_database() AS target_database,
       current_user AS inspection_login;

WITH required(table_name, column_name) AS (
  VALUES
    ('players','id'),('players','data'),
    ('avatars','id'),('avatars','player_id'),('avatars','data'),
    ('sessions','id'),('sessions','player_id'),('sessions','data'),
    ('player_achievements','player_id'),('player_achievements','achievement_id'),
    ('player_achievements','rank'),('player_achievements','progress'),
    ('player_achievements','unlocked_at'),('player_achievements','updated_at'),
    ('game_events','player_id'),('game_events','event_id'),('game_events','timestamp'),
    ('game_events','avatar_id'),('game_events','type'),
    ('game_events','importance'),('game_events','payload'),
    ('progressions','id'),('progressions','player_id'),
    ('progressions','avatar_id'),('progressions','data'),
    ('inventories','id'),('inventories','player_id'),
    ('inventories','avatar_id'),('inventories','data'),
    ('active_encounters','id'),('active_encounters','player_id'),
    ('active_encounters','avatar_id'),('active_encounters','data')
)
SELECT r.table_name, r.column_name,
       CASE WHEN c.column_name IS NOT NULL THEN 'PRESENT' ELSE 'MISSING' END AS status,
       c.data_type
FROM required r
LEFT JOIN information_schema.columns c
  ON c.table_schema='public'
 AND c.table_name=r.table_name
 AND c.column_name=r.column_name
ORDER BY r.table_name, r.column_name;

ROLLBACK;
