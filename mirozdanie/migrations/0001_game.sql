-- Explicit administrator application only. Existing Supabase database; isolated game schema.
CREATE SCHEMA IF NOT EXISTS anything_fishing;
CREATE TABLE IF NOT EXISTS anything_fishing.kv (
 bucket text NOT NULL, id text NOT NULL, doc jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(bucket,id)
);
CREATE INDEX IF NOT EXISTS anything_fishing_kv_bucket_updated ON anything_fishing.kv(bucket,updated_at DESC);
-- Keep the upstream registry/ledger contract available for explicit future migrations.
CREATE TABLE IF NOT EXISTS anything_fishing.serial_registry (
 item_id text NOT NULL, serial_no integer NOT NULL, owner_id text,
 total integer NOT NULL, history jsonb NOT NULL DEFAULT '[]'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(item_id,serial_no)
);
CREATE TABLE IF NOT EXISTS anything_fishing.ledger (
 op_id text PRIMARY KEY,player_id text NOT NULL,kind text NOT NULL,result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- The administrator creates an isolated login role and grants USAGE on this schema
-- and SELECT/INSERT/UPDATE/DELETE on these three tables. No public/auth/Vault grants.
