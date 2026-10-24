# Agent sessions and memory review

Reviewed October 24, 2026 against the implemented application. Recommendations below are extension points, not implemented memory features.

## What a session means today

| Layer                  | Identity and lifetime                                                     | What survives                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser authentication | Random HttpOnly cookie; hashed session row, 30-day expiry or logout       | Maps to the verified RCP account and an encrypted credential; not an AI conversation                                                                                                  |
| User/account           | RCP `whoami.account_id`                                                   | All owned chats across logins and different valid tokens for that same account                                                                                                        |
| Conversation           | Database UUID plus account ownership                                      | Ordered user/assistant parts, tool inputs/results, sources, status, title and pinning                                                                                                 |
| Agent execution        | One POST, bounded to 90 seconds; request ID and per-attempt generation ID | Reserved user turn and pending assistant exist before generation; final rich parts are persisted on completion/interruption                                                           |
| Model context          | Reconstructed for every turn                                              | Server loads user turns and complete assistant turns, converts stored SDK parts to model messages and adds current research instructions                                              |
| MCP connection         | Fresh authenticated client for each chat request                          | Connection closes at the end; the next turn reconnects using the current browser session's credential. There is no application-level reuse of an MCP connection/session between turns |
| Unsent draft           | Browser storage keyed by account and conversation/new chat                | Local text and valid last-message edit context; not sent to the model until submission                                                                                                |

The app owns conversational continuity. It does not create a durable provider-side agent thread, use `previous_response_id`, or depend on a model process remaining alive. AI SDK's tool loop carries state within one execution; saved rich messages supply context on subsequent executions. Replaying a previous tool result supplies evidence to the model; it does not itself re-execute that tool. The model can request fresh calls when it needs current data.

The eight exposed MCP tools are polling reads. Identity discovery happens outside the agent, and feedback/account tools are excluded. Credentials are resolved server-side from the current authenticated session, not from old conversation history. This lets a newer token for the same verified account continue an older conversation, subject to the newer token's upstream access. Already saved evidence remains an account-owned snapshot; permissions are not revalidated for every old snapshot on read.

## Existing strengths and limits

- Account-scoped repository queries and composite ownership constraints separate conversations. Request IDs deduplicate retries; a pending-turn constraint and row locks serialize work within one chat. Generation IDs prevent an earlier attempt from overwriting a newer attempt. Shared admission now adds account/global concurrency budgets across chats and instances.
- Follow-ups replay saved text and complete tool exchanges. Failed/interrupted assistant outputs remain visible but are excluded from model context; their user questions are retained. This can leave unanswered user turns in the prompt. A future context builder should represent those interruptions explicitly instead of implying an answer exists.
- There is no cross-chat user memory, structured conversation state, rolling summary or semantic search. A title is navigation metadata, not a summary. Starting a new conversation starts fresh model context.
- The 350,000-character history check is a coarse safeguard, not token-aware context management. Complete transcripts/tool snapshots grow both cost and latency. Long conversations currently require a new chat; the system does not silently summarize them.
- Assistant/tool parts are saved at turn end. A worker killed before finalization can lose partial streamed text and completed tool results; its pending record becomes retryable after two minutes. Retry reruns research rather than resuming exactly at a durable tool checkpoint. The existing datasets table is not currently the persistence path for evidence.
- Editing the latest question replaces that turn and its answer. There is no immutable turn-revision audit history. Any added summary, checkpoint or memory must be invalidated when its source request/generation changes.
- The browser does not reattach to an existing stream after reload, and runs are not durable background jobs. Admission leases and circuit probes bound/recover work but are not an execution queue or a checkpoint store.

## Recommended extensions

Keep Postgres and the current AI SDK orchestration. There is no need to introduce a second session system or a vector database merely to add memory.

1. **Conversation context first.** Add an owner-scoped context record containing explicitly resolved race IDs, office/cycle, requested date range, comparison set and presentation preference. Save a version and the source request IDs. The current user message always takes precedence. Add a token-budgeted context builder that includes recent turns, a versioned summary of older turns and the relevant source snapshots. Preserve dates and provenance; never summarize away uncertainty or fabricate missing data. This improves “What about Pennsylvania?” and presentation-only follow-ups without conflating chat state with permanent user preferences.
2. **Small, explicit user memory.** Add an owner-scoped `user_memories` table for preferences the user chooses to retain, such as preferred answer format, language or races to follow. Include ID, key/value, provenance, creation/update times and optional expiry. Provide view/edit/forget controls and allow memory to be disabled. Keep current polling numbers, credentials and model-inferred political affiliation out of durable preference memory. Treat stored memory as untrusted context, not system instructions. Retrieval should be server-side and bounded before generation; memory writes should require an explicit user request or confirmation in the product.
3. **Durable runs only when warranted.** If users need to close the tab and return to an in-progress answer, add `agent_runs` and tool-step records with account/conversation/generation IDs, status, deadlines, source snapshots and usage/error metadata. Persist checkpoints before acknowledging completed steps, then run work in a durable worker/queue. Reconnect the UI to that run. Account for read-tool freshness and avoid promising exactly-once external execution. Keep transport sessions, authentication sessions and agent-run IDs separate.

A practical insertion point is a `loadAgentContext(userId, conversationId)` service between authorization/reservation and `agentResponse`. It can load recent messages, conversation context and a bounded set of user-approved memories. A separate completion step can update summaries/context using generation/version checks. Repository methods should require the authenticated owner for every read/write; never accept an owner ID or trusted history from the browser.

Memory provenance should reference the source request/generation, not only a mutable message ID. Editing/deleting a source turn must invalidate dependent summaries and proposed memories. New memory/summary model calls must also use shared admission and circuit protection; they should not bypass the newly added budgets.

## Suggested next scope and acceptance checks

Implement structured conversation context and token-aware history selection first. Add explicit preference memory only if cross-chat personalization is desired; defer durable background agents until there is a requirement to finish work after browser disconnect.

Tests should cover: follow-ups after reload; new token/same account history; different-account isolation; failed/edited-turn context; older summary invalidation; presentation changes without unnecessary retrieval; memory opt-in/forget/expiry and current-request precedence; cross-chat preference reuse without stale polling facts; injected instructions inside stored evidence/memory; and concurrent updates fenced by generation/version. Keep live upstream checks distinct from synthetic failure and load tests.
