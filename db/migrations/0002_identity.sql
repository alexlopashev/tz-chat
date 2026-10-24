-- RCP account IDs own history. Credentials and browser sessions are replaceable.
CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_signed_in_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS rcp_credentials (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id),
  token_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS user_sessions (
  id_hash text PRIMARY KEY CHECK (length(id_hash) = 64),
  user_id text NOT NULL REFERENCES app_users(id),
  credential_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY (credential_id, user_id) REFERENCES rcp_credentials(id, user_id) ON DELETE CASCADE,
  CHECK (expires_at > created_at)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx ON user_sessions(expires_at);
