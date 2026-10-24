import { randomUUID } from "node:crypto";
import type { Database } from "./repository";

export class ProtectionError extends Error {
  readonly status: number;
  constructor(
    public code: string,
    public retryAfter: number,
  ) {
    super(
      code.startsWith("USER_")
        ? `Too many requests. Please wait ${retryAfter} seconds before sending another message.`
        : `The service is experiencing unusually high load or a temporary outage. Please try again in ${retryAfter} seconds.`,
    );
    this.status = code.startsWith("USER_") ? 429 : 503;
  }
}
type Decision = {
  allowed?: boolean;
  code?: string;
  retryAfter?: number;
  epoch: number;
};
export type Outcome = "success" | "failure" | "neutral";
/** Only transient dependency failures affect shared health. User auth/input and cancellation do not. */
export function dependencyOutcome(
  error: unknown,
  signal?: AbortSignal,
): Outcome {
  if (signal?.aborted)
    return signal.reason?.name === "TimeoutError" ? "failure" : "neutral";
  if (error instanceof ProtectionError) return "neutral";
  if (!error || typeof error !== "object") return "neutral";
  if ("rejected" in error) return error.rejected ? "neutral" : "failure";
  const status =
    "statusCode" in error
      ? error.statusCode
      : "status" in error
        ? error.status
        : undefined;
  if (typeof status === "number")
    return status === 429 || status >= 500 ? "failure" : "neutral";
  const name = "name" in error ? error.name : "";
  return name === "TimeoutError" ||
    name === "TypeError" ||
    name === "APICallError" ||
    name === "AI_APICallError"
    ? "failure"
    : "neutral";
}
export class SharedProtection {
  constructor(private db: Database) {}
  private async decision(sql: string, values: unknown[]) {
    let result: Decision;
    try {
      result = (await this.db.query<{ result: Decision }>(sql, values))[0]
        .result;
    } catch {
      throw new ProtectionError("PROTECTION_UNAVAILABLE", 15);
    }
    if (!result.allowed)
      throw new ProtectionError(
        result.code ?? "SERVICE_BUSY",
        result.retryAfter ?? 15,
      );
    return result;
  }
  async admit(owner: string, kind: "chat" | "title") {
    const id = randomUUID();
    await this.decision("SELECT admit_work($1,$2,$3) AS result", [
      owner,
      kind,
      id,
    ]);
    return async () => {
      // Expiry is the final safety net if persistence is temporarily unavailable.
      await this.db
        .query("DELETE FROM runtime_leases WHERE id=$1", [id])
        .catch(() => {
          console.error(JSON.stringify({ event: "work_lease_release_failed" }));
        });
    };
  }
  async circuit(service: "gateway" | "mcp") {
    const probe = randomUUID();
    const { epoch } = await this.decision(
      "SELECT acquire_circuit($1,$2) AS result",
      [service, probe],
    );
    let finished = false;
    return async (outcome: Outcome) => {
      if (finished) return;
      finished = true;
      await this.db
        .query("SELECT finish_circuit($1,$2,$3,$4)", [
          service,
          probe,
          epoch,
          outcome,
        ])
        .catch(() => {
          console.error(
            JSON.stringify({ event: "circuit_update_failed", service }),
          );
        });
    };
  }
  async run<T>(
    service: "gateway" | "mcp",
    action: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const finish = await this.circuit(service);
    try {
      const value = await action();
      await finish("success");
      return value;
    } catch (error) {
      await finish(dependencyOutcome(error, signal));
      throw error;
    }
  }
}
