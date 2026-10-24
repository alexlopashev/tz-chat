ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
-- statement-breakpoint
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title_source text NOT NULL DEFAULT 'fallback' CHECK (title_source IN ('fallback','generated','manual'));
-- statement-breakpoint
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title_revision integer NOT NULL DEFAULT 0;
