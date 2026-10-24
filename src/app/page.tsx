import Link from "next/link";
import { RichMessage } from "@/components/rich-message";

export default function Home() {
  return (
    <div className="app-shell">
      <header className="masthead">
        <Link href="/" className="wordmark">
          RealClear<span>Research</span>
        </Link>
        <span className="eyebrow">
          Conversational polling · Development preview
        </span>
      </header>
      <nav aria-label="Polling resources" className="resource-nav">
        <a href="https://www.realclearpolling.com/">Polling home ↗</a>
        <a href="https://www.realclearpolling.com/latest-polls/senate">
          Latest Senate polls ↗
        </a>
      </nav>
      <main>
        <aside className="sidebar" aria-label="Conversations">
          <h2>Your conversations</h2>
          <p>
            Saved conversations will appear here after account authentication
            and database integration are connected.
          </p>
          <div className="sidebar-note">
            Research with context.
            <br />
            Keep the sources in view.
          </div>
        </aside>
        <section className="conversation" aria-labelledby="chat-title">
          <div className="section-label">The polling desk</div>
          <h1 id="chat-title">A clearer view of the race.</h1>
          <p className="intro">
            Explore the latest polls, compare races, and follow the changes that
            matter—with sources alongside the answer.
          </p>
          <div className="notice" role="note">
            <strong>Foundation preview</strong>
            <p>
              Live chat is not connected yet. No polling data or model responses
              are shown in this preview.
            </p>
          </div>
          <article className="message">
            <span className="message-label">How answers will work</span>
            <RichMessage
              text={
                "Ask a question, then refine it in a follow-up. Answers will distinguish **individual polls**, **published averages**, and **election results**.\n\nTables and charts will include observation dates, coverage gaps, and links to the underlying sources."
              }
            />
          </article>
          <div className="suggestions" aria-label="Example questions">
            <span>How has this race changed?</span>
            <span>Compare two states</span>
            <span>Show the trends side by side</span>
          </div>
          <form className="composer">
            <label htmlFor="question">Your question</label>
            <textarea
              id="question"
              placeholder="Ask about a race, a period, or a comparison…"
              disabled
              aria-describedby="chat-status"
            />
            <div>
              <p id="chat-status">
                Awaiting authentication and live data integration.
              </p>
              <button type="button" disabled>
                Send question ↑
              </button>
            </div>
          </form>
        </section>
      </main>
      <footer>
        Research prototype · Not an official RealClear product · Always consult
        the original source.
      </footer>
    </div>
  );
}
