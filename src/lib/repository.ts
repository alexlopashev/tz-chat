import { randomUUID } from "node:crypto";

export interface Statement {
  text: string;
  values?: unknown[];
}
export interface Database {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<T[]>;
  transaction(statements: Statement[]): Promise<unknown[][]>;
}
export interface Session {
  user_id: string;
  credential_id: string;
  expires_at: string;
}
export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}
export interface SavedMessage {
  id: string;
  role: string;
  parts_json: { type: string; text?: string }[];
  status: string;
}

export class Repository {
  constructor(private db: Database) {}
  async createSession(
    userId: string,
    hash: string,
    ciphertext: string,
    expires: Date,
    previousHash?: string,
  ) {
    const credential = randomUUID();
    await this.db.transaction([
      {
        text: `INSERT INTO app_users (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET last_signed_in_at = now()`,
        values: [userId],
      },
      {
        text: `INSERT INTO rcp_credentials (id,user_id,token_ciphertext) VALUES ($1,$2,$3)`,
        values: [credential, userId, ciphertext],
      },
      {
        text: `INSERT INTO user_sessions (id_hash,user_id,credential_id,expires_at) VALUES ($1,$2,$3,$4)`,
        values: [hash, userId, credential, expires.toISOString()],
      },
      {
        text: `UPDATE user_sessions SET revoked_at = now() WHERE id_hash = $1 AND revoked_at IS NULL`,
        values: [previousHash ?? ""],
      },
    ]);
  }
  async session(hash: string) {
    const rows = await this.db.query<Session>(
      `SELECT user_id,credential_id,expires_at FROM user_sessions WHERE id_hash=$1 AND revoked_at IS NULL AND expires_at > now()`,
      [hash],
    );
    return rows[0] ?? null;
  }
  async revokeSession(hash: string) {
    await this.db.query(
      `UPDATE user_sessions SET revoked_at=now() WHERE id_hash=$1 AND revoked_at IS NULL`,
      [hash],
    );
  }
  async credential(hash: string) {
    const rows = await this.db.query<{
      user_id: string;
      token_ciphertext: string;
    }>(
      `SELECT c.user_id,c.token_ciphertext FROM rcp_credentials c JOIN user_sessions s ON s.credential_id=c.id AND s.user_id=c.user_id WHERE s.id_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()`,
      [hash],
    );
    return rows[0] ?? null;
  }
  async conversations(userId: string) {
    return this.db.query<Conversation>(
      `SELECT id,title,updated_at FROM conversations WHERE owner_id=$1 ORDER BY updated_at DESC, id LIMIT 100`,
      [userId],
    );
  }
  async createConversation(userId: string) {
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO conversations (id,owner_id) VALUES ($1,$2)`,
      [id, userId],
    );
    return id;
  }
  async conversation(userId: string, id: string) {
    const rows = await this.db.query<Conversation>(
      `SELECT id,title,updated_at FROM conversations WHERE id=$1 AND owner_id=$2`,
      [id, userId],
    );
    if (!rows[0]) return null;
    const messages = await this.db.query<SavedMessage>(
      `SELECT id,role,parts_json,status FROM messages WHERE conversation_id=$1 AND owner_id=$2 ORDER BY sequence`,
      [id, userId],
    );
    return { ...rows[0], messages };
  }
  async saveQuestion(
    userId: string,
    id: string,
    text: string,
    requestId: string,
  ) {
    // Row lock plus subsequent statements at READ COMMITTED serialize concurrent saves.
    // A replay uses the same request ID and cannot duplicate the user message.
    const result = await this.db.transaction([
      {
        text: `SELECT id FROM conversations WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        values: [id, userId],
      },
      {
        text: `INSERT INTO messages (id,conversation_id,owner_id,sequence,request_id,role,parts_json,status)
        SELECT $1,c.id,c.owner_id,COALESCE((SELECT max(sequence)+1 FROM messages WHERE conversation_id=c.id),0),$4,'user',$5::jsonb,'complete'
        FROM conversations c WHERE c.id=$2 AND c.owner_id=$3
        ON CONFLICT (conversation_id,request_id,role) DO NOTHING`,
        values: [
          randomUUID(),
          id,
          userId,
          requestId,
          JSON.stringify([{ type: "text", text }]),
        ],
      },
      {
        text: `UPDATE conversations SET updated_at=now(),title=CASE WHEN title='New conversation' THEN $3 ELSE title END WHERE id=$1 AND owner_id=$2 RETURNING id`,
        values: [id, userId, text.slice(0, 90)],
      },
    ]);
    return result[0].length > 0;
  }
}
