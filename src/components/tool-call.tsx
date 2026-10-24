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
  const failed =
    part.state === "output-error" || part.state === "output-denied";
  const completed = part.state === "output-available";
  return (
    <details className="evidence-card tool-call">
      <summary>
        MCP call · {getToolName(part)} ·{" "}
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
            : "This lookup was not allowed."
          : completed
            ? "This saved result cannot be displayed as polling evidence."
            : active
              ? "Waiting for this RCP lookup to complete."
              : "This lookup did not finish."}
      </p>
      {part.input !== undefined && (
        <>
          <strong>Arguments</strong>
          <pre className="tool-json">{JSON.stringify(part.input, null, 2)}</pre>
        </>
      )}
    </details>
  );
}
