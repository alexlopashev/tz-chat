import {
  averageTables,
  isEvidence,
  historyChanges,
} from "@/lib/agent/evidence";

export function EvidenceCard({ output }: { output: unknown }) {
  if (!isEvidence(output)) return null;
  const tables = averageTables(output);
  const trend =
    output.tool === "get_race_average_history"
      ? historyChanges(output.data)
      : null;
  return (
    <details
      className="evidence-card"
      open={tables.length > 0 || Boolean(trend)}
    >
      <summary>RCP evidence · {output.tool.replaceAll("_", " ")}</summary>
      <p className="field-help">
        Retrieved {output.retrievedAt.replace("T", " ").slice(0, 19)} UTC ·
        Saved snapshot
      </p>
      {tables.map((race, index) => (
        <div key={index}>
          <strong>{race.title}</strong>
          <p className="field-help">
            Published RCP average ·{" "}
            {race.current_average?.date_label ?? "Period not supplied"} ·
            Updated {race.current_average?.as_of ?? "date unavailable"}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Support (%)</th>
                </tr>
              </thead>
              <tbody>
                {race.current_average?.results.map((candidate, i) => (
                  <tr key={i}>
                    <td>{candidate.name}</td>
                    <td>
                      {candidate.value === null
                        ? "Not available"
                        : candidate.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {trend && (
        <div>
          <strong>Published-average support changes</strong>
          <p className="field-help">
            Requested: {String(output.requested.from ?? "start unspecified")} to{" "}
            {String(output.requested.to ?? "end unspecified")}. Returned
            observations: {trend.from ?? "none"} to {trend.to ?? "none"} (
            {trend.points} points). Changes use the actual endpoints, which may
            not cover the full requested period.
          </p>
          {trend.changes.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Start (%)</th>
                    <th>End (%)</th>
                    <th>Change (pp)</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.changes.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{row.start ?? "Missing"}</td>
                      <td>{row.end ?? "Missing"}</td>
                      <td>
                        {row.changePp === null
                          ? "Not available"
                          : (row.changePp > 0 ? "+" : "") + row.changePp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="field-help">
              Not enough observations to calculate a change.
            </p>
          )}
        </div>
      )}
      {!tables.length && !trend && (
        <p className="field-help">
          Evidence retrieved for this answer. Sources and dates are preserved
          with the conversation.
        </p>
      )}
      {output.sources.length > 0 ? (
        <ul className="evidence-sources">
          {output.sources.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {new URL(url).hostname} · source
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-help">No source URL was supplied by this lookup.</p>
      )}
    </details>
  );
}
