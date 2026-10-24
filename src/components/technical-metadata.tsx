import { usageTotals, type RunUsage } from "@/lib/usage";
function tokens(value: number | null) {
  return value === null ? "Not reported" : value.toLocaleString("en-US");
}
function dollars(value: number | null) {
  return value === null
    ? "Not reported"
    : `$${value.toFixed(8).replace(/0+$/, "").replace(/\.$/, ".00")}`;
}
function Totals({ runs }: { runs: RunUsage[] }) {
  const total = usageTotals(runs);
  return (
    <>
      <dl className="usage-grid">
        {(
          [
            ["Input tokens", total.input],
            ["Uncached input", total.uncached],
            ["Cache read", total.cacheRead],
            ["Cache write", total.cacheWrite],
            ["Output tokens", total.output],
          ] as const
        ).map(([label, metric]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {tokens(metric.value)}
              {metric.missing > 0 && metric.value !== null ? " (partial)" : ""}
            </dd>
          </div>
        ))}
        <div>
          <dt>
            {total.estimated
              ? "Cost (includes estimates)"
              : "Gateway-reported cost"}
          </dt>
          <dd>
            {dollars(total.costUsd.value)}
            {total.costUsd.missing > 0 && total.costUsd.value !== null
              ? " (partial)"
              : ""}{" "}
            USD
          </dd>
        </div>
      </dl>
      <p className="field-help">
        {total.steps} reported model calls · {total.runs} attempts. Output
        includes reasoning tokens. Cache reads and writes are subsets of input.
      </p>
      {total.incomplete && (
        <p className="field-help">
          Pending, interrupted or failed work may have unreported usage. Totals
          cover the reported calls, not a guaranteed final bill.
        </p>
      )}
    </>
  );
}
export function ResponseMetadata({ run }: { run?: RunUsage }) {
  return (
    <details className="technical-metadata response-metadata">
      <summary role="button">Response metadata</summary>
      {!run ? (
        <p className="field-help">Usage was not recorded for this response.</p>
      ) : (
        <>
          <p className="field-help">
            {run.model} · {run.status} · {(run.elapsedMs / 1000).toFixed(1)}s ·{" "}
            {run.toolCalls} tool calls
          </p>
          <p className="field-help">
            Cache: {run.cachePolicy}. A requested policy does not guarantee a
            cache hit.
          </p>
          <Totals runs={[run]} />
          {run.steps.map((step) => (
            <details className="usage-step" key={step.index}>
              <summary role="button">
                Model call {step.index + 1} ·{" "}
                {step.provider ?? "provider not reported"} ·{" "}
                {dollars(step.costUsd)} ({step.costSource})
              </summary>
              <p className="field-help">
                {step.model} · Finish: {step.finishReason} · Reasoning:{" "}
                {tokens(step.reasoning)}
              </p>
              <p className="field-help">
                Input {tokens(step.input)} · Uncached {tokens(step.uncached)} ·
                Read {tokens(step.cacheRead)} · Write {tokens(step.cacheWrite)}{" "}
                · Output {tokens(step.output)}
              </p>
              {step.rates && (
                <p className="field-help">
                  Catalog USD / 1M tokens: input{" "}
                  {dollars(step.rates.input * 1e6)}, cache read{" "}
                  {dollars(
                    step.rates.cacheRead === null
                      ? null
                      : step.rates.cacheRead * 1e6,
                  )}
                  , cache write{" "}
                  {dollars(
                    step.rates.cacheWrite === null
                      ? null
                      : step.rates.cacheWrite * 1e6,
                  )}
                  , output {dollars(step.rates.output * 1e6)}. Snapshot:{" "}
                  {step.rates.fetchedAt}. Reported Gateway cost takes precedence
                  over catalog estimates.
                </p>
              )}
            </details>
          ))}
        </>
      )}
    </details>
  );
}
export function ConversationMetadata({
  runs,
  untracked,
}: {
  runs: RunUsage[];
  untracked: number;
}) {
  return (
    <details className="technical-metadata conversation-metadata">
      <summary role="button">Technical metadata · Conversation totals</summary>
      <div className="usage-scroll">
        <Totals runs={runs} />
        <p className="field-help">
          Includes research, retries, replaced answers and title generation for
          this conversation across sign-ins. Model costs only; excludes MCP,
          hosting and database charges.
        </p>
        {untracked > 0 && (
          <p className="field-help">
            {untracked} responses have no recorded metadata. Earlier usage
            cannot be reconstructed.
          </p>
        )}
        <p className="field-help">
          Research attempts: {runs.filter((r) => r.kind === "chat").length} ·
          Title attempts: {runs.filter((r) => r.kind === "title").length}
        </p>
        {runs
          .filter((r) => r.kind === "title")
          .map((run) => (
            <ResponseMetadata key={run.id} run={run} />
          ))}
      </div>
    </details>
  );
}
