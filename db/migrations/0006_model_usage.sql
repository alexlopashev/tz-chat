-- One durable record per attempt, including title work and superseded answers.
CREATE TABLE IF NOT EXISTS model_usage (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  owner_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('chat','title')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','failed','interrupted')),
  metadata_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, owner_id) REFERENCES conversations(id, owner_id) ON DELETE CASCADE
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS model_usage_conversation_idx ON model_usage(conversation_id, owner_id, created_at);
