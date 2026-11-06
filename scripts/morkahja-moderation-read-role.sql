-- OPERATOR REVIEW REQUIRED. Do not apply automatically.
-- A distinct SELECT-only identity for real Morkahja account lists/details.
-- It is intentionally NOT the established babuni_admin_probe Overview role.
-- Run as the database owner/DBA only after inspecting privileges and backups.
-- Password is deliberately NULL; set a strong password privately with psql's
-- \password babuni_admin_moderation (never commit one to the repository).
BEGIN;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

CREATE ROLE babuni_admin_moderation
  LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD NULL;

-- Bind the grant to the *currently connected* database. Confirm this
-- matches the private Nobara probe configuration before running the script.
DO $
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO babuni_admin_moderation',
    current_database());
END
$;
GRANT USAGE ON SCHEMA public TO babuni_admin_moderation;

GRANT SELECT ON TABLE
  public.players,
  public.avatars,
  public.sessions,
  public.player_achievements,
  public.game_events,
  public.progressions,
  public.inventories,
  public.active_encounters
TO babuni_admin_moderation;

-- No UPDATE, DELETE, INSERT, TRUNCATE or CREATE grants.
-- This stage permits account inspection, NOT timeout/ban/unban.
COMMIT;
