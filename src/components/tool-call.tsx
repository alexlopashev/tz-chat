import { getToolName } from "ai";
import type { ChatMessage } from "@/lib/chat-types";
import { isEvidence } from "@/lib/agent/evidence";
import { EvidenceCard } from "./evidence-card";

type CallPart = Extract<ChatMessage["parts"][number], { toolCallId: string }>;
export function ToolCall({
  part,
  active,
}: {
  part: CallPart;
  active: boolean;
}) {
  if (part.state === "output-available" && isEvidence(part.output))
    return <EvidenceCard output={part.output} />;
  const research = getToolName(part) === "research_tools";
  const evidence =
    research &&
    part.state === "output-available" &&
    part.output &&
    typeof part.output === "object" &&
    "evidence" in part.output &&
    Array.isArray(part.output.evidence)
      ? part.output.evidence.filter(isEvidence)
      : [];
  const discovery = getToolName(part) === "search_tools";
  const executionError =
    research &&
    part.state === "output-available" &&
    part.output &&
    typeof part.output === "object" &&
    "error" in part.output &&
    typeof part.output.error === "string"
      ? part.output.error
      : undefined;
  const failed =
    !!executionError ||
    part.state === "output-error" ||
    part.state === "output-denied";
  const completed = part.state === "output-available";
  return (
    <>
      {evidence.map((output, index) => (
        <EvidenceCard key={index} output={output} />
      ))}
      <details className="evidence-card tool-call">
        <summary>
          {research
            ? "Tool research"
            : discovery
              ? "Tool discovery"
              : "MCP call"}{" "}
          · {getToolName(part)} ·{" "}
          {failed
            ? "Failed"
            : completed
              ? "Completed"
              : active
                ? "In progress"
                : "Incomplete"}
        </summary>
        <p className="field-help">
          {failed
            ? part.state === "output-error"
              ? part.errorText
              : (executionError ?? "This lookup was not allowed.")
            : completed
              ? discovery || research
                ? "Tool discovery and execution details. Polling evidence is displayed separately."
                : "This saved result cannot be displayed as polling evidence."
              : active
                ? discovery || research
                  ? "Finding relevant polling tools."
                  : "Waiting for this RCP lookup to complete."
                : "This lookup did not finish."}
        </p>
        {(discovery || research) && completed && (
          <pre className="tool-json">
            {JSON.stringify(part.output, null, 2)}
          </pre>
        )}
        {part.input !== undefined && (
          <>
            <strong>Arguments</strong>
            <pre className="tool-json">
              {JSON.stringify(part.input, null, 2)}
            </pre>
          </>
        )}
      </details>
    </>
  );
}
