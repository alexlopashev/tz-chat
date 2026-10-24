-- Initial, repeatable schema. All private children carry their parent's owner.
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL CHECK (length(owner_id) > 0),
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS conversations_owner_updated_idx ON conversations (owner_id, updated_at DESC);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  owner_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence >= 0),
  request_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  parts_json jsonb NOT NULL CHECK (jsonb_typeof(parts_json) = 'array'),
  status text NOT NULL CHECK (status IN ('pending', 'complete', 'failed', 'interrupted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, owner_id) REFERENCES conversations(id, owner_id) ON DELETE CASCADE,
  UNIQUE (conversation_id, sequence),
  UNIQUE (conversation_id, request_id, role)
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS messages_one_pending_assistant_idx ON messages (conversation_id) WHERE role = 'assistant' AND status = 'pending';
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS datasets (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  owner_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('individual_polls', 'published_average', 'election_results')),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  snapshot_json jsonb NOT NULL,
  metadata_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, owner_id) REFERENCES conversations(id, owner_id) ON DELETE CASCADE
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS datasets_conversation_idx ON datasets (conversation_id);
