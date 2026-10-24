/** A visual landing-page mock, deliberately without invented polling figures. */
export function RcpBackdrop({ inactive }: { inactive: boolean }) {
  const site = "https://www.realclearpolling.com/";
  return (
    <div
      className="mock-backdrop"
      inert={inactive}
      aria-hidden={inactive}
      aria-label="RealClearPolling landing page preview"
    >
      <header className="mock-navigation">
        <a
          href={site}
          target="_blank"
          rel="noopener noreferrer"
          className="mock-wordmark"
        >
          <span className="brand-highlight">RealClear</span> Polling
        </a>
        <a
          href={`${site}latest-polls/senate`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Polls <span>⌄</span>
        </a>
        <a href={site} target="_blank" rel="noopener noreferrer">
          Election 2026/2028 <span>⌄</span>
        </a>
        <div className="mock-search">
          Search <span>Find any poll</span>
        </div>
        <span className="mock-ai">✦ RCP + AI</span>
      </header>
      <div className="mock-page">
        <div className="mock-edition">
          <span>THE BIG PICTURE</span>
          <span className="preview-label">
            Landing page preview · not live polling data
          </span>
        </div>
        <div className="mock-columns">
          <div>
            <section className="mock-hero">
              <span className="mock-kicker">REALCLEAR POLLING</span>
              <h1>
                The latest polls.
                <br />A <mark>clearer picture.</mark>
              </h1>
              <p>
                Explore the races. Follow the trends.
                <br />
                Find the context behind the numbers.
              </p>
              <a
                href={`${site}latest-polls/senate`}
                target="_blank"
                rel="noopener noreferrer"
                className="mock-explore"
              >
                Explore the polls <span>↗</span>
              </a>
            </section>
            <nav
              className="mock-categories"
              aria-label="Preview polling categories"
            >
              {["Senate", "Governor", "President", "Approval"].map(
                (name, index) => (
                  <a
                    key={name}
                    href={site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={index === 0 ? "selected" : undefined}
                  >
                    {name}
                  </a>
                ),
              )}
            </nav>
            <section className="mock-races">
              <div className="mock-section-heading">
                <h2>Explore the races</h2>
                <a href={site} target="_blank" rel="noopener noreferrer">
                  View all ↗
                </a>
              </div>
              {["Maine Senate", "Michigan Senate", "Georgia Senate"].map(
                (race, index) => (
                  <a
                    className="mock-race-row"
                    key={race}
                    href={site}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="mock-race-number">0{index + 1}</span>
                    <strong>{race}</strong>
                    <span>Race overview ↗</span>
                  </a>
                ),
              )}
            </section>
            <div className="mock-bottom-note">
              A place for the polls. A space to ask better questions.
            </div>
          </div>
          <aside className="mock-right-column">
            <a
              className="mock-archive"
              href={site}
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>RCP Polling Archive</strong>
              <span>Explore the history ↗</span>
            </a>
            <div className="mock-sidebar-heading">◢ ELECTION WATCH</div>
            {[
              "Battle for the Senate",
              "Governor races",
              "National polling",
            ].map((name) => (
              <a
                className="mock-sidebar-link"
                href={site}
                target="_blank"
                rel="noopener noreferrer"
                key={name}
              >
                {name}
                <span>↗</span>
              </a>
            ))}
            <div className="mock-research-card">
              <span>✦</span>
              <h2>Go beyond the headline.</h2>
              <p>
                Open the polling assistant to explore sources, compare races,
                and follow what’s changed.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
