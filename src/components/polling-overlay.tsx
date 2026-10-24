"use client";
import { useRef, useState, type CSSProperties } from "react";
import { RcpBackdrop } from "./rcp-backdrop";

export function PollingOverlay({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(520);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [frameVersion, setFrameVersion] = useState(0);
  const [liveBackdrop, setLiveBackdrop] = useState(false);
  const previousWidth = useRef(520);
  const panel = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  function resize(next: number) {
    const bounded = Math.max(
      Math.min(360, window.innerWidth),
      Math.min(window.innerWidth, next),
    );
    setWidth(bounded);
    setExpanded(bounded >= window.innerWidth - 2);
    if (bounded < window.innerWidth - 2) previousWidth.current = bounded;
  }
  function toggleExpanded() {
    if (expanded) {
      setWidth(previousWidth.current);
      setExpanded(false);
    } else {
      previousWidth.current = width;
      setExpanded(true);
    }
  }
  return (
    <div className={`polling-overlay${resizing ? " is-resizing" : ""}`}>
      {liveBackdrop ? (
        <iframe
          key={frameVersion}
          inert={open && expanded}
          aria-hidden={open && expanded}
          className="site-backdrop"
          src="https://www.realclearpolling.com/"
          title="RealClearPolling website"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      ) : (
        <RcpBackdrop inactive={open && expanded} />
      )}
      <div
        className="backdrop-tools"
        inert={open && expanded}
        aria-hidden={open && expanded}
      >
        <a
          href="https://www.realclearpolling.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open RealClearPolling ↗
        </a>
        <button type="button" onClick={() => setLiveBackdrop(!liveBackdrop)}>
          {liveBackdrop ? "Use preview backdrop" : "Try live website"}
        </button>
        {liveBackdrop && (
          <>
            <button
              type="button"
              onClick={() => setFrameVersion((version) => version + 1)}
              aria-label="Reload website"
            >
              ↻
            </button>
            <p>
              Live site not displaying? Use the preview or open it in a new tab.
            </p>
          </>
        )}
      </div>
      {resizing && <div className="resize-shield" />}
      <section
        id="polling-chat-panel"
        ref={panel}
        tabIndex={-1}
        className="overlay-panel"
        data-expanded={expanded}
        hidden={!open}
        style={{ "--panel-width": `${width}px` } as CSSProperties}
        aria-label="Polling research assistant"
      >
        <div
          className="panel-resizer"
          role="separator"
          tabIndex={0}
          aria-label="Resize chat panel"
          aria-orientation="vertical"
          aria-valuemin={360}
          aria-valuenow={width}
          aria-valuetext={expanded ? "Full window" : `${width} pixels wide`}
          title="Drag to resize. Use arrow keys, Home or End. Double-click to expand."
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setResizing(true);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              resize(window.innerWidth - event.clientX);
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setResizing(false);
          }}
          onPointerCancel={() => setResizing(false)}
          onLostPointerCapture={() => setResizing(false)}
          onDoubleClick={toggleExpanded}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const current =
              panel.current?.getBoundingClientRect().width ?? width;
            resize(
              event.key === "Home"
                ? 360
                : event.key === "End"
                  ? window.innerWidth
                  : current + (event.key === "ArrowLeft" ? 32 : -32),
            );
          }}
        >
          <span />
        </div>
        <header className="overlay-toolbar">
          <div
            className="panel-brand"
            aria-label="RealClear Polling AI research"
          >
            <span className="brand-highlight">RealClear</span>
            <span>Polling</span>
            <span className="ai-badge">✦ AI</span>
          </div>
          <div className="panel-window-actions">
            <button
              type="button"
              className="icon-button expand-panel"
              onClick={toggleExpanded}
              aria-label={
                expanded ? "Restore side panel" : "Expand to full window"
              }
              title={expanded ? "Restore side panel" : "Expand to full window"}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  d={
                    expanded
                      ? "M9 3v6H3m12-6v6h6M3 15h6v6m6 0v-6h6"
                      : "M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"
                  }
                />
              </svg>
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setOpen(false);
                requestAnimationFrame(() => launcher.current?.focus());
              }}
              aria-label="Minimize chat"
              title="Minimize chat"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M5 12h14" />
              </svg>
            </button>
          </div>
        </header>
        <div className="overlay-body">{children}</div>
      </section>
      {!open && (
        <button
          ref={launcher}
          type="button"
          aria-controls="polling-chat-panel"
          aria-expanded={open}
          aria-label="RCP + AI — Open chat"
          className="chat-launcher"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => panel.current?.focus());
          }}
        >
          <span>✦ RCP + AI</span>
        </button>
      )}
    </div>
  );
}
