import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { expect, type Page } from "@playwright/test";

export const authenticated = Boolean(process.env.E2E_RCP_TOKEN);
export const fixturesEnabled =
  authenticated &&
  process.env.E2E_ALLOW_DB_FIXTURES === "1" &&
  Boolean(process.env.DATABASE_URL);
export const panelName = "Polling research assistant";

export async function openPanel(page: Page) {
  const launcher = page.getByRole("button", {
    name: "RCP + AI — Open chat",
    exact: true,
  });
  if (await launcher.isVisible()) await launcher.click();
  await expect(
    page.getByRole("region", { name: panelName, exact: true }),
  ).toBeVisible();
}
export async function signIn(page: Page) {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await openPanel(page);
  // The runner must never print this value or record network traces.
  await page
    .getByLabel("Your RCP MCP token", { exact: true })
    .fill(process.env.E2E_RCP_TOKEN!);
  await page.getByRole("button", { name: /Connect and continue/ }).click();
  try {
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible({ timeout: 40_000 });
  } finally {
    const input = page.getByLabel("Your RCP MCP token", { exact: true });
    if (await input.isVisible()) await input.fill("").catch(() => {});
  }
}
export async function createFixture(page: Page, suffix: string) {
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/conversations", {
    headers: { Origin: origin },
    data: {},
  });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  const title = `Chrome UX ${suffix} ${id.slice(0, 8)}`;
  const sql = neon(process.env.DATABASE_URL!);
  await sql`UPDATE conversations SET title=${title},title_source='manual' WHERE id=${id}`;
  return { id, title };
}
export async function seedEvidence(id: string) {
  const sql = neon(process.env.DATABASE_URL!);
  const evidence = {
    kind: "rcp-evidence",
    tool: "get_race_average_history",
    retrievedAt: "2026-10-24T12:00:00Z",
    requested: { from: "2026-10-01", to: "2026-10-20" },
    sources: ["https://www.realclearpolling.com/"],
    data: {
      columns: ["date", "results", "spread"],
      rows: [
        [
          "2026-10-01",
          [
            ["Fixture Democrat", "D", 48],
            ["Fixture Republican", "R", 47],
          ],
          1,
        ],
        [
          "2026-10-10",
          [
            ["Fixture Democrat", "D", 48.5],
            ["Fixture Republican", "R", null],
          ],
          null,
        ],
        [
          "2026-10-20",
          [
            ["Fixture Democrat", "D", 48.8],
            ["Fixture Republican", "R", 47.4],
          ],
          1.4,
        ],
      ],
    },
  };
  const question = [
    { type: "text", text: "Show this synthetic test race as a chart." },
  ];
  const parts = [
    {
      type: "text",
      text: "Synthetic browser fixture: published-average chart and saved evidence.",
    },
    {
      type: "tool-research_tools",
      toolCallId: randomUUID(),
      state: "output-available",
      input: { js: "return await tools.get_race_average_history({});" },
      output: { evidence: [evidence], result: null },
    },
  ];
  const requestId = randomUUID();
  await sql`INSERT INTO messages (id,conversation_id,owner_id,sequence,request_id,role,parts_json,status) SELECT ${randomUUID()},id,owner_id,0,${requestId},'user',${JSON.stringify(question)}::jsonb,'complete' FROM conversations WHERE id=${id}`;
  await sql`INSERT INTO messages (id,conversation_id,owner_id,sequence,request_id,role,parts_json,status) SELECT ${randomUUID()},id,owner_id,1,${requestId},'assistant',${JSON.stringify(parts)}::jsonb,'complete' FROM conversations WHERE id=${id}`;
}
export async function removeFixtures(ids: string[]) {
  if (!ids.length) return;
  const sql = neon(process.env.DATABASE_URL!);
  // One atomic cleanup, scoped only to exact IDs created by this run.
  await sql`DELETE FROM conversations WHERE id=ANY(${ids}::uuid[])`;
}
