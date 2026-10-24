"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import type { Conversation, SavedMessage } from "@/lib/repository";
import { toChatMessages, type ChatMessage } from "@/lib/chat-types";
import { SiteHeader } from "./site-header";
import { RichMessage } from "./rich-message";
import { EvidenceCard } from "./evidence-card";

type Selected = Conversation & { messages: SavedMessage[] };
export function ResearchDesk({
  userId,
  conversations,
  selected,
  missing,
}: {
  userId: string;
  conversations: Conversation[];
  selected: Selected | null;
  missing: boolean;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const conversationId = useRef(selected?.id);
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        prepareSendMessagesRequest: ({ messages, body }) => {
          const message = messages.findLast((m) => m.role === "user");
          return {
            api: "/api/conversations/" + body?.conversationId + "/messages",
            body: {
              text: message?.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n"),
              requestId: message?.metadata?.requestId ?? message?.id,
            },
          };
        },
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          if (response.ok) return response;
          const data = await response
            .json()
            .catch(() => ({ error: "The request failed. Please try again." }));
          return new Response(data.error, {
            status: response.status,
            headers: { "Content-Type": "text/plain" },
          });
        },
      }),
    [],
  );
  function syncLocation() {
    if (conversationId.current)
      router.replace("/?chat=" + conversationId.current);
    router.refresh();
  }
  const { messages, sendMessage, regenerate, stop, status, error, clearError } =
    useChat<ChatMessage>({
      id: selected?.id,
      messages: selected ? toChatMessages(selected.messages) : [],
      generateId: () => crypto.randomUUID(),
      transport,
      throttle: 50,
      onFinish: syncLocation,
    });
  const busy = accountBusy || status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const retryable =
    !busy &&
    (Boolean(error) ||
      last?.metadata?.status === "failed" ||
      last?.metadata?.status === "interrupted");
  async function request(path: string) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "The request failed.");
    return data;
  }
  async function signOut() {
    setAccountBusy(true);
    setActionError("");
    try {
      await request("/api/auth/sign-out");
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setActionError("Couldn't sign out. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !question.trim()) return;
    setAccountBusy(true);
    setActionError("");
    clearError();
    try {
      if (!conversationId.current)
        conversationId.current = (await request("/api/conversations")).id;
      const text = question.trim();
      setQuestion("");
      await sendMessage(
        { text },
        { body: { conversationId: conversationId.current } },
      );
    } catch {
      setActionError("Couldn't send the question. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <SiteHeader>
        <div className="account-controls">
          <span className="account-label">
            <span className="status-dot" />
            Connected to RCP{" "}
            <span className="account-id">{userId.slice(0, 8)}</span>
          </span>
          <button
            className="secondary-button"
            onClick={signOut}
            disabled={busy}
          >
            Sign out
          </button>
        </div>
      </SiteHeader>
      <nav className="resource-nav" aria-label="Polling resources">
        <a
          href="https://www.realclearpolling.com/latest-polls/senate"
          target="_blank"
          rel="noopener noreferrer"
        >
          Latest Senate polls ↗
        </a>
        <span>Research workspace</span>
      </nav>
      <main className="desk-layout">
        <aside className="sidebar" aria-label="Chat history">
          <Link href="/" className="new-chat">
            ＋ New chat
          </Link>
          <h2>Recent chats</h2>
          {conversations.length ? (
            <ul className="chat-list">
              {conversations.map((chat) => (
                <li key={chat.id}>
                  <Link
                    href={"/?chat=" + chat.id}
                    aria-current={selected?.id === chat.id ? "page" : undefined}
                  >
                    {chat.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Your conversations will appear here. They stay with your RCP
              account.
            </p>
          )}
          <div className="sidebar-note">
            Keep the sources
            <br />
            in view.
          </div>
        </aside>
        <section className="conversation" aria-labelledby="chat-title">
          <span className="section-label">The polling desk</span>
          <h1 id="chat-title">
            {selected?.title ?? "What are you researching?"}
          </h1>
          {missing && (
            <p role="alert" className="form-error">
              That conversation isn’t available for this account.
            </p>
          )}
          <p className="intro">
            Start with a question. Your research stays here when you return.
          </p>
          <p className="research-note">
            Answers use RCP sources. Check the dates and coverage alongside the
            evidence.
          </p>
          <div className="message-list" aria-live="polite">
            {messages.map((message) => (
              <article className="message saved-message" key={message.id}>
                <span className="message-label">
                  {message.role === "user"
                    ? "Your question"
                    : "Research assistant"}
                </span>
                {message.parts.map((part, index) => {
                  if (part.type === "text")
                    return <RichMessage key={index} text={part.text} />;
                  if (
                    part.type === "data-error" &&
                    typeof part.data === "string"
                  )
                    return (
                      <p className="form-error" key={index}>
                        {part.data}
                      </p>
                    );
                  if (isToolUIPart(part)) {
                    if (part.state === "output-available")
                      return <EvidenceCard key={index} output={part.output} />;
                    if (part.state === "output-error")
                      return (
                        <p className="field-help" key={index}>
                          An RCP lookup failed. {part.errorText}
                        </p>
                      );
                    return (
                      <p className="tool-progress" key={index}>
                        Looking up RCP data ·{" "}
                        {getToolName(part).replaceAll("_", " ")}…
                      </p>
                    );
                  }
                  return null;
                })}
                {message.metadata?.status &&
                  message.metadata.status !== "complete" &&
                  message.role === "assistant" && (
                    <p className="field-help">
                      Response{" "}
                      {message.metadata.status === "pending" && !busy
                        ? "in progress; reload shortly"
                        : message.metadata.status}
                      .
                    </p>
                  )}
              </article>
            ))}
          </div>
          {!messages.length && (
            <div className="empty-research">
              <span aria-hidden="true">↗</span>
              <p>A question is a good place to start.</p>
              <p className="field-help">
                Ask about a race, a time period, or a comparison.
              </p>
            </div>
          )}
          <form className="composer" onSubmit={save}>
            <label htmlFor="question">Your question</label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={4000}
              disabled={busy}
              placeholder="What has changed in the Maine Senate race?"
              required
              aria-describedby="save-help"
            />
            <div>
              <p id="save-help">
                Your questions and sourced answers are saved to your account.
              </p>
              <button type="submit" disabled={busy || !question.trim()}>
                {busy ? "Researching…" : "Send question ↑"}
              </button>
            </div>
          </form>
          {busy && (
            <div className="stream-status" role="status">
              {status === "streaming"
                ? "Writing your answer…"
                : "Researching your question…"}{" "}
              <button
                type="button"
                className="secondary-button"
                onClick={() => stop()}
              >
                Stop
              </button>
            </div>
          )}
          {(actionError || error) && (
            <p role="alert" className="form-error">
              {actionError || error?.message}
            </p>
          )}
          {retryable && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                clearError();
                regenerate({
                  body: { conversationId: conversationId.current },
                });
              }}
            >
              Retry answer
            </button>
          )}
          {!busy && last?.metadata?.status === "pending" && (
            <button
              className="secondary-button"
              onClick={() => window.location.reload()}
            >
              Reload response
            </button>
          )}
        </section>
      </main>
      <footer>
        Research prototype · Not an official RealClear product · Always consult
        the original source.
      </footer>
    </div>
  );
}
