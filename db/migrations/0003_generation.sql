-- Per-attempt fencing protects retries from late completion of an older request.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS generation_id uuid;
-- statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS generation_started_at timestamptz;
