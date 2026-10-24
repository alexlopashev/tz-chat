"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Conversation, SavedMessage } from "@/lib/repository";
import { SiteHeader } from "./site-header";
import { RichMessage } from "./rich-message";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState(selected?.messages ?? []);
  const pending = useRef<{
    text: string;
    requestId: string;
    id?: string;
  } | null>(null);
  async function request(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(25_000),
    });
    const data = await response.json();
    if (response.status === 401) {
      router.replace("/sign-in");
      router.refresh();
      throw new Error("Please sign in again.");
    }
    if (!response.ok)
      throw new Error(data.error ?? "Something went wrong. Please try again.");
    return data;
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await request("/api/auth/sign-out");
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Couldn't sign out. Please try again.");
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !question.trim()) return;
    setBusy(true);
    setError("");
    try {
      const text = question.trim();
      if (!pending.current || pending.current.text !== text)
        pending.current = {
          text,
          requestId: crypto.randomUUID(),
          id: pending.current?.id ?? selected?.id,
        };
      const turn = pending.current;
      if (!turn.id) turn.id = (await request("/api/conversations")).id;
      await request(`/api/conversations/${turn.id}/messages`, {
        text,
        requestId: turn.requestId,
      });
      setMessages([
        ...messages,
        {
          id: turn.requestId,
          role: "user",
          parts_json: [{ type: "text", text }],
          status: "complete",
        },
      ]);
      setQuestion("");
      pending.current = null;
      router.push(`/?chat=${turn.id}`);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "TimeoutError"
          ? e.message
          : "The save timed out. Retry to check whether your question was saved.",
      );
    } finally {
      setBusy(false);
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
                    href={`/?chat=${chat.id}`}
                    aria-current={selected?.id === chat.id ? "page" : undefined}
                  >
                    {chat.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Your saved questions will appear here. They stay with your RCP
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
          <div className="notice" role="note">
            <strong>History is ready. Live answers are coming next.</strong>
            <p>
              You can save and reopen questions now. AI responses are not
              connected yet; saving a question does not generate an answer.
            </p>
          </div>
          <div className="message-list" aria-live="polite">
            {messages.map((message) => (
              <article className="message saved-message" key={message.id}>
                <span className="message-label">
                  {message.role === "user"
                    ? "Your question"
                    : "Research assistant"}
                </span>
                {message.parts_json.map((part, index) =>
                  part.type === "text" && part.text ? (
                    <RichMessage key={index} text={part.text} />
                  ) : null,
                )}
                {message.status !== "complete" && (
                  <p className="field-help">Response {message.status}.</p>
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
              placeholder="What has changed in the Senate races?"
              required
              aria-describedby="save-help"
            />
            <div>
              <p id="save-help">Saved privately to your RCP account.</p>
              <button type="submit" disabled={busy || !question.trim()}>
                {busy ? "Saving…" : "Save question ↑"}
              </button>
            </div>
          </form>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
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
