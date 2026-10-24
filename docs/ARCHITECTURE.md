# Architecture

The Next.js backend is the application's origin and backend-for-frontend. It authenticates requests, owns persistence and invokes external services. The browser receives streamed answers and safe evidence, never the stored MCP credential. GitHub contains the implementation; Vercel runs it; Neon supplies shared durable state.

```mermaid
flowchart LR
  GitHub[GitHub source] -->|Git deployment| Vercel[Vercel: Next.js]
  Browser[Browser: chat panel] -->|Session cookie and user input| Vercel
  Vercel -->|Accounts, sessions, history, limits| Neon[(Neon Postgres)]
  Vercel -->|AI SDK model requests| Gateway[Vercel AI Gateway]
  Gateway --> LLM[Selected model provider]
  Vercel -->|User's bearer token| MCP[RCP MCP: identity and polling tools]
  Vercel -->|Streamed text and tool parts| Browser
```

## Component boundaries

| Component          | Role                                                                                                        | Implementation                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Browser UI         | Sign-in, chat/history, drafts, waiting states, Stop/Retry, collapsed MCP drawers and evidence-driven charts | [`src/components`](../src/components)                                                                         |
| Next.js routes     | Same-origin write checks, session authorization, input validation, admission and streaming lifecycle        | [`src/app/api`](../src/app/api)                                                                               |
| Authentication     | Verified RCP identity, encrypted credentials and opaque browser sessions                                    | [`src/lib/auth`](../src/lib/auth)                                                                             |
| Repository         | Owner-scoped SQL, ordered history, atomic turn reservation and completion fencing                           | [`src/lib/repository.ts`](../src/lib/repository.ts)                                                           |
| Shared protection  | Distributed quotas, expiring work leases and dependency circuit breakers                                    | [`src/lib/protection.ts`](../src/lib/protection.ts), migration `0005`                                         |
| Agent              | Prompt/context conversion, bounded model/tool loop and response persistence callbacks                       | [`src/lib/agent`](../src/lib/agent)                                                                           |
| Service transports | Neon HTTP queries, Gateway model selection and authenticated MCP connections                                | [`database.ts`](../src/lib/database.ts), [`gateway.ts`](../src/lib/gateway.ts), [`mcp.ts`](../src/lib/mcp.ts) |

Next.js route handlers run server-side; there is no separate long-running agent server. Database operations have independent 15-second timeouts. A model call, MCP connection and browser authentication session have different lifetimes.

## Authentication and user identity

1. The user pastes an existing RCP MCP token. The backend normalizes an optional `Bearer ` prefix and connects to the allowlisted MCP endpoint.
2. The backend calls `whoami` and validates the returned `account_id` UUID. It does not decode the token to infer identity or accept a user ID from the browser.
3. That account ID becomes the stable application owner. Different valid RCP tokens for the same account access the same history.
4. The backend encrypts the token with AES-256-GCM using `RCP_TOKEN_ENCRYPTION_KEY`. A random nonce is generated for each ciphertext, and the account ID is authenticated as associated data.
5. The backend creates a random 256-bit session ID, stores its SHA-256 hash and returns the original ID only in a cookie. The session links to the encrypted credential and verified account.

The cookie is HttpOnly, SameSite=Lax and host-only; HTTPS adds Secure and the `__Host-` prefix. Sessions expire after 30 days without silent renewal. Logout revokes the current session; signing in again replaces that browser's prior session. JWT access/refresh tokens are not used.

For each authenticated request, the backend checks session expiry/revocation and obtains the account ID from the database. MCP calls decrypt the credential associated with that current session, rather than retaining an older chat's token. Cookie-authenticated writes check Origin against the trusted host or configured `APP_ORIGIN`.

RCP token revocation is not pushed into the app: the browser session can remain valid while subsequent MCP calls reject its credential. Already saved evidence remains account-owned history. Expired sessions and credential rows are retained until explicitly maintained; automatic retention and account-wide session management are not implemented.

## Database structure and conversation protection

| Table               | Stored state and relationships                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_users`         | Stable verified RCP account ID and sign-in timestamps                                                                                                          |
| `rcp_credentials`   | Encrypted token per sign-in, linked to `app_users`                                                                                                             |
| `user_sessions`     | Hashed session ID, owner, credential, expiry and revocation; composite foreign key binds the credential to the same owner                                      |
| `conversations`     | UUID, owner ID, title, title source/revision, pin and timestamps                                                                                               |
| `messages`          | Conversation and owner, sequence, request ID, role, rich SDK parts, status, generation ID and start time                                                       |
| `datasets`          | Reserved snapshot schema; currently unused by the agent. Actual evidence is saved in `messages.parts_json`                                                     |
| `runtime_buckets`   | Shared per-account/global request-window counters                                                                                                              |
| `runtime_leases`    | Active chat/title work with expiry for crash recovery                                                                                                          |
| `runtime_circuits`  | Gateway/MCP failure counts, cooldowns and fenced recovery probes                                                                                               |
| `model_usage`       | Owner-scoped usage ledger per research/title attempt, with per-step token counts, pricing snapshots, cost provenance and status; survives answer edits/retries |
| `schema_migrations` | Applied versions and content checksums                                                                                                                         |

Conversation ownership is enforced by authenticated, owner-scoped repository queries. Composite foreign keys prevent messages/datasets from claiming a different owner than their parent conversation. `conversations.owner_id` holds the verified account ID; it is not itself a foreign key to `app_users`. There is no database row-level-security policy: authorization depends on the backend query boundary and constraints. Application-level encryption covers MCP credentials; chat text and evidence are ordinary database records protected by access control, not individually encrypted by this application.

A short transaction locks the conversation row before reserving a user/assistant pair. Unique `(conversation_id, sequence)` and `(conversation_id, request_id, role)` constraints prevent duplicate ordering and duplicate turns. A partial unique index allows one pending assistant per conversation. Retries retain the logical request ID but get a new generation ID; completion updates only the matching pending generation, so late results cannot overwrite a newer attempt.

Editing the latest question checks its previous request ID, replaces that turn and reserves a new generation atomically. Older turns remain intact. There is no immutable edit history. Pending attempts older than two minutes become retryable as interrupted. These mechanisms prevent conflicting writes; they do not resume an interrupted model execution.

User questions are persisted before generation. Assistant text, tool inputs/results and sources are saved together as SDK message parts at finalization, with `complete`, `failed` or `interrupted` status. Usage is also checkpointed after each completed model step in a separate attempt ledger. A worker killed before finalization may lose streamed partial output and tool results; the ledger retains completed-step measurements, while the interrupted call may have unreported usage. The pending row survives, allowing a later retry.

Unsent drafts live separately in browser local storage, keyed by account and conversation, with a separate new-chat key. Text and valid edit context restore for up to 30 days and clear after server acceptance. Storage failures do not block chat. Drafts are local-device convenience data, not server history, cross-device synchronization or a credential store.

## One agent turn

```mermaid
sequenceDiagram
  participant UI as Browser / useChat
  participant API as Next.js route
  participant DB as Neon
  participant Agent as AI SDK
  participant LLM as Gateway / model
  participant MCP as RCP MCP
  UI->>API: Text, request ID, conversation ID, optional edit
  API->>DB: Authenticate, authorize, admit work, reserve turn
  API->>DB: Load owned conversation history
  API->>MCP: Connect with current user's token; discover tools
  API->>Agent: Instructions, reconstructed messages, allowed tools
  loop Up to six model steps
    Agent->>LLM: Context and tool definitions
    LLM-->>Agent: Text and/or tool calls
    opt Model requests polling data
      Agent->>MCP: Execute bounded read-only calls
      MCP-->>Agent: Results normalized into evidence
    end
    Agent-->>UI: Stream text and tool-state updates
  end
  Agent->>DB: Persist final rich parts and fenced status
  Agent->>MCP: Close client
  Agent->>DB: Release work lease; record dependency health
```

The browser uses AI SDK `useChat` and `DefaultChatTransport`, but sends only the question, identifiers and optional edit metadata. It does not supply trusted conversation history. The route loads history from Neon and includes user turns and complete assistant turns. `convertToModelMessages` converts rich UI parts into model text/tool exchanges and ignores incomplete tool calls. Failed/interrupted assistant content stays visible in the UI but is not replayed to the model; its user question remains in history.

`streamText` receives the research system instructions, reconstructed messages, Gateway model and tool definitions. One user turn can require several LLM requests: a model step requests tools, the SDK executes them, and the next model step receives their results. The sixth step disables further tool selection so the model can conclude with available evidence. Automatic model retries are disabled; a user retry is a new execution attempt.

Each chat request creates a fresh MCP client. Tool discovery is filtered to these eight reads:

`search_races`, `get_race`, `get_race_polls`, `get_race_average_history`, `compare_races`, `list_pollsters`, `get_race_ratings`, `get_rating_changes`.

The server supplies research-purpose fields. `whoami` is used only by sign-in, and feedback/account tools are not exposed to the agent. MCP content is untrusted: results are size-checked, normalized and scrubbed of account/session/token metadata before becoming evidence. Tool failures become explicit errors rather than fabricated polling values. Tables and charts derive their numbers from the saved evidence; Markdown cannot execute HTML or chart code.

| Execution bound                            | Value                                   |
| ------------------------------------------ | --------------------------------------- |
| Overall turn deadline / route maximum      | 90 seconds / 120 seconds                |
| Model steps / output per step              | 6 / 3,000 tokens                        |
| MCP calls / concurrent tool calls          | 10 / 2                                  |
| Tool discovery / individual lookup timeout | 10 seconds / 12 seconds                 |
| Tool result size / historical context size | 120,000 characters / 350,000 characters |

The history limit is character-based, not token-aware summarization. Stop requests cancel the execution; finalization saves available parts when possible. Browser reload does not reconnect to an existing stream. There is no provider-side conversation ID, durable background queue or reusable cross-turn MCP client.

Chat titles are separate model work. Automatic and manual generation use `generateText` with `openai/gpt-6-luna`, bounded question-only context, a 12-second timeout and 160 output tokens. Title revision checks prevent delayed generation from overwriting a newer manual change. Title generation does not provide memory for the research model.

## Prompt caching and usage accounting

For GPT-6 and supported GPT-5.6+ model IDs, the AI SDK sends `openai.promptCacheOptions: { mode: "implicit", ttl: "30m" }` and `promptCacheKey`; these map to OpenAI's `prompt_cache_options` and `prompt_cache_key`. The stable system-instruction message also carries `promptCacheBreakpoint: { mode: "explicit", ttl: "30m" }`, retaining implicit conversation caching while marking the stable prefix. Older OpenAI model IDs receive a stable key with provider-default retention instead of incompatible modern options. Non-OpenAI models use Gateway automatic caching. Cache policy is configured in [`cache.ts`](../src/lib/agent/cache.ts).

The key is a SHA-256 digest of prompt version, verified owner, conversation, model and work kind. It remains stable across turns, retries and sign-ins for that conversation, while research and titles have separate keys. It is also the Gateway `sessionId`, with `sessionAffinity: true` and `caching: "auto"`. The key is a routing/accounting hint, not an authorization mechanism or a provider-side conversation store. OpenAI `store: false` disables stored Responses state; it does not disable prompt caching or replace provider data-retention policies.

Stable instructions come before a separate date-context message. Tool definitions are sorted by name and schema object keys are canonicalized. Saved history is replayed in order without rewriting prior turns; technical usage data is excluded from model context. Every model step still sends the full required context. Cache matching, minimum sizes, expiry and routing determine actual reuse; sending the options does not guarantee a hit.

[OpenAI's caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) describes modern cache controls and [Gateway session affinity](https://vercel.com/docs/ai-gateway/models-and-providers/session-affinity) describes routing. The installed Gateway forwards AI SDK provider options. No direct OpenAI credential or new dependency is required.

### Response and conversation metadata

`model_usage` records one row per execution attempt, including title work. The row is created before generation, updated at step start/end, and finalized on completion, error or interruption. Edits/retries create new attempts, so replacing an answer does not erase its historical cost. Queries are owner-scoped and a composite conversation/owner foreign key protects the parent relationship. A pending record older than two minutes is presented as interrupted.

Each assistant response streams a safe usage summary as message metadata and saves a `data-usage` part for reload. It includes model/provider, elapsed time, call counts, cache policy, per-step usage and cost provenance. Raw provider metadata, credentials and request headers are not exposed. The AI SDK excludes this custom data part from model history. The bottom technical drawer totals the conversation across sign-ins, including title generation and superseded attempts; this is not a browser-login-session total.

| Measurement              | Meaning                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Input                    | Total input tokens reported by the SDK                                                                                   |
| Uncached input           | Non-cached input; distinct from cache-read/write tokens                                                                  |
| Cache read / cache write | Provider-reported subsets of input, including cache creation when reported                                               |
| Output                   | Total generated tokens, including reasoning; reasoning is also shown separately                                          |
| Gateway-reported cost    | The per-step `providerMetadata.gateway.cost` in USD, preferred when available                                            |
| Estimated cost           | Fallback using complete token categories and matching-model catalog rates captured at execution time; explicitly labeled |
| Missing/partial usage    | Shown as not reported/partial, never assumed to be zero or free                                                          |

Catalog rates come from `getAvailableModels()` and are cached in-process for ten minutes. They are **USD per token**; the UI displays them per million. The estimate is `uncached × input rate + cache reads × read rate + cache writes × write rate + output × output rate`. It is calculated only when the categories reconcile and required rates are available. Reasoning tokens are not charged twice. A changed routed model without a matching rate snapshot gets no catalog estimate. Reported Gateway cost takes precedence and can reflect provider-specific pricing that a base catalog estimate cannot.

Only model costs are included, not MCP, Vercel hosting or Neon. Failed/aborted calls may not report usage; historical responses created before this feature cannot be backfilled. Completed-step accounting survives many interruptions, but the ledger is not an invoice or a durable background agent. Accounting-write failures are logged safely and marked on the response; they do not discard an otherwise valid answer. Live verification observed both cache writes and cache reads over a real MCP-backed conversation and its follow-up.

### Other kinds of reuse

Saved tool evidence is replayed as history without re-executing that call. The model can request fresh MCP data when needed; there is no cross-turn application MCP response cache. Private HTTP responses remain `no-store`. Vercel build caching is unrelated to model prompt caching, and neither cache replaces authorization or persistent conversation history.

## Shared reliability and abuse limits

Postgres admission is shared across Vercel instances and keyed to the verified account, so opening another browser session does not reset the user's budget. Fixed windows start with the first admitted request. A short advisory-locked transaction checks/updates counters and creates a lease; it holds no lock during model/tool execution.

| Budget             | Research turns, including edits/retries | Titles, automatic/manual |
| ------------------ | --------------------------------------- | ------------------------ |
| Per account        | 8/minute, 60/hour                       | 3/minute, 20/hour        |
| Active per account | 2                                       | 1                        |
| Global rate        | 40/minute                               | 20/minute                |
| Global active work | 20                                      | 4                        |
| Lease expiry       | 120 seconds                             | 30 seconds               |

Rejected admission does not reserve a message or consume quota. Admitted attempts consume quota even if later setup fails. Leases release at completion/cancellation/setup failure; expiry recovers terminated workers. These limits count turns, not individual LLM requests. The per-turn bounds above limit work within each admission. Fixed-window boundary bursts remain possible.

Separate shared Gateway and MCP circuit breakers open for 30 seconds after five consecutive qualifying transient failures within 30 seconds. One global recovery probe is allowed; success closes the circuit, failure reopens it, and probe expiry recovers a crashed worker. Epochs fence stale completions. Gateway health is tracked per answer/title; MCP health observes chat HTTP transport requests. HTTP 429/5xx and recognized transport failures count, while credential/input errors, local throttling and user cancellation do not. MCP errors inside an HTTP 200 result are not transport circuit signals.

Per-user limits return 429; shared capacity, circuit or protection-storage rejection returns 503. Responses include safe messages and `Retry-After`. The UI preserves rejected drafts/edits and shows a cooldown. Once streaming begins, HTTP status cannot change; subsequent failures use streamed error content and saved-question retry behavior. New expensive work fails closed when protection state cannot be checked.

These are conservative demo limits, not measured production throughput. Postgres remains a shared dependency and the admission lock trades simplicity for throughput. Anonymous sign-in and inexpensive endpoints need separate edge abuse controls before public launch.

## Conversation context and user memory

Current continuity is per-conversation transcript replay. There is no structured race/date state, rolling summary, cross-chat preference memory, semantic retrieval or durable agent-run store. A new chat starts with fresh model context. The application does not silently collect user memories.

The natural extension is an owner-scoped context-loading service before `agentResponse`: load recent turns, a versioned summary or structured race/date context, and a bounded set of explicitly retained user preferences. Start with token-aware history selection and conversation context; add user-visible preference memory with edit/forget/expiry controls only when cross-chat personalization is needed. Current polling numbers and inferred political affiliations should not become permanent preferences.

Summaries/memories should reference source request/generation IDs, since message IDs can survive edits. Invalidate derived state when its source changes; fence concurrent updates by version. Treat memory as untrusted context, with the current request taking precedence. Any extra model calls for summarization or memory must also use shared protection.

If work must continue after browser disconnect, add durable run/tool-step checkpoints and a worker/queue. That is a separate execution capability, not an extension of the login cookie or MCP transport session. Exactly-once external tool execution is not currently promised.
