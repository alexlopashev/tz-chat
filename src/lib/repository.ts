import { randomUUID } from "node:crypto";
import type { StoredMessage, MessageStatus } from "./chat-types";
import type { UIMessage } from "ai";

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
  pinned_at: string | null;
  title_source: "fallback" | "generated" | "manual";
  title_revision: number;
  last_message_at?: string;
}
export type SavedMessage = StoredMessage;

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
  async ownsConversation(userId: string, id: string) {
    const rows = await this.db.query(
      "SELECT id FROM conversations WHERE owner_id=$1 AND id=$2",
      [userId, id],
    );
    return rows.length > 0;
  }
  async conversations(userId: string) {
    return this.db.query<Conversation>(
      `WITH activity AS (
        SELECT c.id,c.title,c.updated_at,c.pinned_at,c.title_source,c.title_revision,
          COALESCE((SELECT max(GREATEST(m.created_at,m.generation_started_at)) FROM messages m WHERE m.conversation_id=c.id AND m.owner_id=c.owner_id),c.created_at) AS last_message_at
        FROM conversations c WHERE c.owner_id=$1
      ), ranked AS (
        SELECT *,row_number() OVER (PARTITION BY (pinned_at IS NOT NULL) ORDER BY last_message_at DESC,id) AS position FROM activity
      ) SELECT id,title,updated_at,pinned_at,title_source,title_revision,last_message_at FROM ranked
      WHERE pinned_at IS NOT NULL OR position<=100 ORDER BY last_message_at DESC,id`,
      [userId],
    );
  }
  async pinConversation(userId: string, id: string, pinned: boolean) {
    const rows = await this.db.query(
      `UPDATE conversations SET pinned_at=CASE WHEN $3::boolean THEN COALESCE(pinned_at,now()) ELSE NULL END WHERE id=$1 AND owner_id=$2 RETURNING id`,
      [id, userId, pinned],
    );
    return rows.length > 0;
  }
  async renameConversation(userId: string, id: string, title: string) {
    const rows = await this.db.query(
      `UPDATE conversations SET title=$3,title_source='manual',title_revision=title_revision+1 WHERE id=$1 AND owner_id=$2 RETURNING id`,
      [id, userId, title],
    );
    return rows.length > 0;
  }
  async setGeneratedTitle(
    userId: string,
    id: string,
    title: string,
    expectedRevision: number,
    automatic = false,
  ) {
    const rows = await this.db.query(
      `UPDATE conversations SET title=$3,title_source='generated',title_revision=title_revision+1 WHERE id=$1 AND owner_id=$2 AND title_revision=$4 AND (NOT $5::boolean OR title_source='fallback') RETURNING id`,
      [id, userId, title, expectedRevision, automatic],
    );
    return rows.length > 0;
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
      `SELECT id,title,updated_at,pinned_at,title_source,title_revision FROM conversations WHERE id=$1 AND owner_id=$2`,
      [id, userId],
    );
    if (!rows[0]) return null;
    const messages = await this.db.query<SavedMessage>(
      `SELECT id,role,request_id,parts_json,CASE WHEN status='pending' AND generation_started_at < now()-interval '2 minutes' THEN 'interrupted' ELSE status END AS status FROM messages WHERE conversation_id=$1 AND owner_id=$2 ORDER BY sequence`,
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
  async reserveTurn(
    userId: string,
    conversationId: string,
    text: string,
    requestId: string,
    edit?: { messageId: string; previousRequestId: string },
  ) {
    const generationId = randomUUID();
    const assistantId = randomUUID();
    const parts = JSON.stringify([{ type: "text", text }]);
    const offset = edit ? 2 : 0;
    const result = await this.db.transaction([
      {
        text: `SELECT id FROM conversations WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        values: [conversationId, userId],
      },
      {
        text: `UPDATE messages SET status='interrupted' WHERE conversation_id=$1 AND owner_id=$2 AND role='assistant' AND status='pending' AND generation_started_at < now()-interval '2 minutes'`,
        values: [conversationId, userId],
      },
      ...(edit
        ? [
            {
              text: `UPDATE messages u SET parts_json=$4::jsonb,request_id=$3
          WHERE u.conversation_id=$1 AND u.owner_id=$2 AND u.id=$5 AND u.request_id=$6 AND u.role='user'
          AND $3::uuid<>$6::uuid
          AND NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id=$1 AND role='user' AND sequence>u.sequence)
          AND NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id=$1 AND role='assistant' AND status='pending')
          AND NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id=$1 AND request_id=$3)`,
              values: [
                conversationId,
                userId,
                requestId,
                parts,
                edit.messageId,
                edit.previousRequestId,
              ],
            },
            {
              text: `UPDATE messages SET request_id=$3,parts_json='[]',status='failed',generation_id=NULL
          WHERE conversation_id=$1 AND owner_id=$2 AND role='assistant' AND request_id=$4
          AND $3::uuid<>$4::uuid
          AND EXISTS (SELECT 1 FROM messages u WHERE u.conversation_id=$1 AND u.owner_id=$2 AND u.id=$5 AND u.role='user' AND u.request_id=$3 AND u.parts_json=$6::jsonb)`,
              values: [
                conversationId,
                userId,
                requestId,
                edit.previousRequestId,
                edit.messageId,
                parts,
              ],
            },
          ]
        : []),
      {
        text: `INSERT INTO messages (id,conversation_id,owner_id,sequence,request_id,role,parts_json,status)
        SELECT $3,c.id,c.owner_id,COALESCE((SELECT max(sequence)+1 FROM messages WHERE conversation_id=c.id),0),$3,'user',$4::jsonb,'complete'
        FROM conversations c WHERE c.id=$1 AND c.owner_id=$2 AND NOT $5::boolean
        AND NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id=c.id AND status='pending' AND role='assistant')
        ON CONFLICT (conversation_id,request_id,role) DO NOTHING`,
        values: [conversationId, userId, requestId, parts, Boolean(edit)],
      },
      {
        text: `INSERT INTO messages (id,conversation_id,owner_id,sequence,request_id,role,parts_json,status,generation_id,generation_started_at)
        SELECT $5,c.id,c.owner_id,COALESCE((SELECT max(sequence)+1 FROM messages WHERE conversation_id=c.id),0),$3,'assistant','[]','pending',$6,now()
        FROM conversations c JOIN messages u ON u.conversation_id=c.id AND u.owner_id=c.owner_id AND u.request_id=$3 AND u.role='user'
        WHERE c.id=$1 AND c.owner_id=$2 AND u.parts_json=$4::jsonb
        AND NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id=c.id AND status='pending' AND role='assistant')
        AND NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id=c.id AND role='user' AND sequence>u.sequence)
        ON CONFLICT (conversation_id,request_id,role) DO UPDATE SET parts_json='[]',status='pending',generation_id=EXCLUDED.generation_id,generation_started_at=now()
        WHERE messages.status IN ('failed','interrupted') RETURNING id`,
        values: [
          conversationId,
          userId,
          requestId,
          parts,
          assistantId,
          generationId,
        ],
      },
      {
        text: `UPDATE conversations SET updated_at=now(),title=CASE WHEN title_source='fallback' AND (title='New conversation' OR ($4::boolean AND (SELECT request_id FROM messages WHERE conversation_id=$1 AND role='user' ORDER BY sequence LIMIT 1)=$5::uuid)) THEN $3 ELSE title END,title_revision=title_revision+CASE WHEN $4::boolean AND EXISTS (SELECT 1 FROM messages WHERE conversation_id=$1 AND role='user' AND request_id=$5::uuid AND parts_json=$6::jsonb) THEN 1 ELSE 0 END WHERE id=$1 AND owner_id=$2`,
        values: [
          conversationId,
          userId,
          text.slice(0, 90),
          Boolean(edit),
          requestId,
          parts,
        ],
      },
      {
        text: `SELECT role,status,parts_json,parts_json=$4::jsonb AS matches_input FROM messages WHERE conversation_id=$1 AND owner_id=$2 AND request_id=$3 ORDER BY sequence`,
        values: [conversationId, userId, requestId, parts],
      },
    ]);
    if (!result[0].length) return { kind: "not-found" as const };
    if (result[3 + offset].length)
      return {
        kind: "reserved" as const,
        assistantId: (result[3 + offset][0] as { id: string }).id,
        generationId,
      };
    const rows = result[5 + offset] as {
      role: string;
      status: string;
      parts_json: unknown;
      matches_input: boolean;
    }[];
    if (rows.some((r) => r.role === "user" && !r.matches_input))
      return { kind: "conflict" as const };
    if (rows.some((r) => r.role === "assistant" && r.status === "complete"))
      return { kind: "complete" as const };
    return { kind: "busy" as const };
  }
  async finishTurn(
    userId: string,
    conversationId: string,
    assistantId: string,
    generationId: string,
    parts: UIMessage["parts"],
    status: Exclude<MessageStatus, "pending">,
  ) {
    const rows = await this.db.query(
      `UPDATE messages SET parts_json=$5::jsonb,status=$6
      WHERE id=$1 AND owner_id=$2 AND conversation_id=$3 AND generation_id=$4 AND status='pending' RETURNING id`,
      [
        assistantId,
        userId,
        conversationId,
        generationId,
        JSON.stringify(parts),
        status,
      ],
    );
    return rows.length === 1;
  }
}
