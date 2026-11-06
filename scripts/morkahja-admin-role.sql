-- Morkahja single-owner Babuni Admin account.
-- Operator-review SQL: apply only from the verified "morkahja" database.
-- One operator login supports existing player inspection AND ban/timeout/unban.
-- Deliberately no PostgreSQL superuser or arbitrary SQL capabilities.
-- Password is unset here: use psql \password babuni_admin interactively.
BEGIN;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='2s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='babuni_admin') THEN
    CREATE ROLE babuni_admin LOGIN NOINHERIT NOSUPERUSER NOCREATEDB
      NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;
  END IF;
END $$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO babuni_admin',current_database());
END $$;

GRANT USAGE ON SCHEMA public TO babuni_admin;
GRANT SELECT ON TABLE
  public.players, public.avatars, public.sessions,
  public.player_achievements, public.game_events,
  public.progressions, public.inventories, public.active_encounters
TO babuni_admin;
GRANT UPDATE (data) ON public.players TO babuni_admin;
GRANT DELETE ON public.sessions TO babuni_admin;
-- Content catalogs use the same SSH identity and separate filesystem access,
-- not additional PostgreSQL users.
COMMIT;
