import { afterEach, expect, it, vi } from "vitest";
const factory = vi.hoisted(() =>
  vi.fn(() => ({
    query: vi.fn(async () => []),
    transaction: vi.fn(async () => []),
  })),
);
vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({ neon: factory }));
import { database } from "../src/lib/database";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("creates a fresh deadline for each operation, including a later stream finalization", async () => {
  vi.stubEnv("DATABASE_URL", "postgres://test.invalid/test");
  const db = database();
  await db.query("SELECT 1");
  await db.query("SELECT 2");
  await db.transaction([{ text: "SELECT 3" }]);
  expect(factory).toHaveBeenCalledTimes(3);
  const signals = factory.mock.calls.map(
    (call) =>
      (
        call as unknown as [string, { fetchOptions: { signal: AbortSignal } }]
      )[1].fetchOptions.signal,
  );
  expect(new Set(signals).size).toBe(3);
  expect(signals.every((signal) => !signal.aborted)).toBe(true);
});
