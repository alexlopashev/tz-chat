import { z } from "zod";
export const pollingToolNames = [
  "search_races",
  "get_race",
  "get_race_polls",
  "get_race_average_history",
  "compare_races",
  "list_pollsters",
  "get_race_ratings",
  "get_rating_changes",
] as const;
export type PollingToolName = (typeof pollingToolNames)[number];
export interface Evidence {
  kind: "rcp-evidence";
  tool: string;
  retrievedAt: string;
  requested: Record<string, unknown>;
  data: Record<string, unknown>;
  sources: string[];
  calculations?: ReturnType<typeof historyChanges>;
}
function scrub(value: unknown, depth = 0): unknown {
  if (depth > 20) throw new Error("RCP returned overly nested data.");
  if (Array.isArray(value))
    return value.map((child) => scrub(child, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) =>
            ![
              "call_id",
              "token_id",
              "token_prefix",
              "account_id",
              "session_id",
              "__proto__",
              "constructor",
              "prototype",
            ].includes(k),
        )
        .map(([k, v]) => [k, scrub(v, depth + 1)]),
    );
  return value;
}
export function normalizeEvidence(
  tool: string,
  requested: Record<string, unknown>,
  result: unknown,
  now = new Date(),
): Evidence {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      content: z.array(
        z.object({ type: z.string(), text: z.string().optional() }),
      ),
    })
    .parse(result);
  if (envelope.isError)
    throw new Error(
      "RCP could not complete this lookup. Try a narrower query.",
    );
  if (JSON.stringify(result).length > 120_000)
    throw new Error(
      "RCP returned too much data. Narrow the date range or reduce the limit.",
    );
  let data: Record<string, unknown> | undefined;
  for (const block of envelope.content) {
    if (block.type !== "text" || !block.text) continue;
    try {
      const parsed = z
        .record(z.string(), z.unknown())
        .safeParse(JSON.parse(block.text));
      if (parsed.success) {
        data = scrub(parsed.data) as Record<string, unknown>;
        break;
      }
    } catch {
      /* Summary text is not evidence. */
    }
  }
  if (!data) throw new Error("RCP returned an unsupported data format.");
  const sources = new Set<string>();
  function visit(value: unknown) {
    if (typeof value === "string" && value.startsWith("https://")) {
      try {
        const u = new URL(value);
        if (!u.username && !u.password) sources.add(u.toString());
      } catch {}
    } else if (value && typeof value === "object")
      for (const child of Object.values(value)) visit(child);
  }
  visit(data);
  return {
    kind: "rcp-evidence",
    tool,
    retrievedAt: now.toISOString(),
    requested,
    data,
    sources: [...sources].slice(0, 30),
    ...(tool === "get_race_average_history"
      ? { calculations: historyChanges(data) }
      : {}),
  };
}
export function isEvidence(value: unknown): value is Evidence {
  return z
    .object({
      kind: z.literal("rcp-evidence"),
      tool: z.string(),
      retrievedAt: z.string(),
      requested: z.record(z.string(), z.unknown()),
      data: z.record(z.string(), z.unknown()),
      sources: z.array(z.string().url()),
    })
    .safeParse(value).success;
}
const average = z.object({
  title: z.string(),
  current_average: z
    .object({
      results: z.array(
        z.object({ name: z.string(), value: z.number().finite().nullable() }),
      ),
      as_of: z.string().nullable().optional(),
      date_label: z.string().nullable().optional(),
    })
    .nullable(),
});
export function averageTables(evidence: Evidence) {
  const candidates = Array.isArray(evidence.data.races)
    ? evidence.data.races
    : [evidence.data];
  return candidates
    .flatMap((candidate) => {
      const parsed = average.safeParse(candidate);
      return parsed.success && parsed.data.current_average ? [parsed.data] : [];
    })
    .slice(0, 10);
}

const historySchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(
    z.tuple([
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.array(
        z.tuple([
          z.string(),
          z.string().nullable(),
          z.number().finite().nullable(),
        ]),
      ),
      z.number().finite().nullable(),
    ]),
  ),
});
export function historyChanges(data: Record<string, unknown>) {
  const parsed = historySchema.safeParse(data);
  if (
    !parsed.success ||
    parsed.data.columns.join(",") !== "date,results,spread"
  )
    return null;
  const rows = parsed.data.rows;
  if (rows.length < 2)
    return {
      from: rows[0]?.[0] ?? null,
      to: rows[0]?.[0] ?? null,
      points: rows.length,
      changes: [],
    };
  const first = rows[0],
    last = rows[rows.length - 1];
  const names = [...new Set([...first[1], ...last[1]].map((row) => row[0]))];
  return {
    from: first[0],
    to: last[0],
    points: rows.length,
    changes: names.map((name) => {
      const start = first[1].find((row) => row[0] === name)?.[2] ?? null;
      const end = last[1].find((row) => row[0] === name)?.[2] ?? null;
      return {
        name,
        start,
        end,
        changePp:
          start === null || end === null
            ? null
            : Math.round((end - start) * 1e8) / 1e8,
      };
    }),
  };
}

/** Validated, chronological observations; never fill missing support with zero. */
export function historySeries(data: Record<string, unknown>) {
  const parsed = historySchema.safeParse(data);
  if (
    !parsed.success ||
    parsed.data.columns.join(",") !== "date,results,spread"
  )
    return null;
  const rows = [...parsed.data.rows].sort((a, b) => a[0].localeCompare(b[0]));
  if (
    rows.length < 2 ||
    new Set(rows.map((row) => row[0])).size !== rows.length
  )
    return null;
  if (
    rows.some(
      (row) =>
        !Number.isFinite(Date.parse(row[0])) ||
        new Date(row[0]).toISOString().slice(0, 10) !== row[0],
    )
  )
    return null;
  const names = [
    ...new Set(rows.flatMap((row) => row[1].map((candidate) => candidate[0]))),
  ];
  const series = names.map((name) => ({
    name,
    points: rows.map((row) => {
      const value =
        row[1].find((candidate) => candidate[0] === name)?.[2] ?? null;
      return {
        date: row[0],
        value: value !== null && value >= 0 && value <= 100 ? value : null,
      };
    }),
  }));
  return series.some(
    (candidate) =>
      candidate.points.filter((point) => point.value !== null).length >= 2,
  )
    ? series
    : null;
}
