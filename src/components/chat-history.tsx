"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/repository";

function ChatHistoryItem({
  chat,
  selectedId,
  disabled,
}: {
  chat: Conversation;
  selectedId?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const blocked = useRef(disabled);
  const refreshPending = useRef(false);
  useEffect(() => {
    blocked.current = disabled;
    if (!disabled && refreshPending.current) {
      refreshPending.current = false;
      router.refresh();
    }
  }, [disabled, router]);
  useEffect(() => {
    if (renaming) {
      input.current?.focus();
      input.current?.select();
    }
  }, [renaming]);
  async function change(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/conversations/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Couldn't update this chat.");
      setRenaming(false);
      if (menu.current) menu.current.open = false;
      if (blocked.current) refreshPending.current = true;
      else router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Couldn't update this chat.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="chat-history-item">
      <div className="chat-history-row">
        <Link
          href={`/?chat=${chat.id}`}
          aria-current={selectedId === chat.id ? "page" : undefined}
        >
          {chat.title}
        </Link>
        <details className="chat-actions" ref={menu}>
          <summary aria-label={`Actions for ${chat.title}`}>⋯</summary>
          <div className="chat-action-menu">
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => change({ action: "pin", pinned: !chat.pinned_at })}
            >
              {chat.pinned_at ? "Unpin" : "Pin to favourites"}
            </button>
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => {
                setTitle(chat.title);
                setRenaming(true);
                if (menu.current) menu.current.open = false;
              }}
            >
              Rename
            </button>
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => change({ action: "regenerate-title" })}
            >
              {busy ? "Updating…" : "Regenerate title"}
            </button>
          </div>
        </details>
      </div>
      {renaming && (
        <form
          className="rename-chat"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && title.trim())
              void change({ action: "rename", title: title.trim() });
          }}
        >
          <label htmlFor={`title-${chat.id}`}>Chat name</label>
          <input
            ref={input}
            id={`title-${chat.id}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={90}
            required
            disabled={busy || disabled}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !busy) setRenaming(false);
            }}
          />
          <div>
            <button disabled={busy || disabled || !title.trim()} type="submit">
              Save name
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={busy || disabled}
              onClick={() => setRenaming(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {busy && (
        <p className="field-help" role="status">
          Updating chat…
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
export function ChatHistory({
  conversations,
  selectedId,
  disabled,
}: {
  conversations: Conversation[];
  selectedId?: string;
  disabled?: boolean;
}) {
  const pinned = conversations.filter((chat) => chat.pinned_at);
  const recent = conversations.filter((chat) => !chat.pinned_at);
  return (
    <>
      <section aria-label="Pinned chats" className="pinned-chats">
        <h2>Pinned</h2>
        <ul className="chat-list">
          {pinned.map((chat) => (
            <ChatHistoryItem
              key={chat.id}
              chat={chat}
              selectedId={selectedId}
              disabled={disabled}
            />
          ))}
        </ul>
      </section>
      <section aria-label="Recent chats">
        <h2>Recent chats</h2>
        <ul className="chat-list">
          {recent.map((chat) => (
            <ChatHistoryItem
              key={chat.id}
              chat={chat}
              selectedId={selectedId}
              disabled={disabled}
            />
          ))}
        </ul>
        {!conversations.length && (
          <p>
            Your conversations will appear here. They stay with your RCP
            account.
          </p>
        )}
      </section>
    </>
  );
}
