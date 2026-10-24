import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import AxeBuilder from "@axe-core/playwright";
import {
  createFixture,
  fixturesEnabled,
  openPanel,
  panelName,
  removeFixtures,
  seedEvidence,
  signIn,
} from "./helpers";

test("Chrome: saved chat UX, accessible charts, drafts, menus and throttling", async ({
  page,
}, testInfo) => {
  test.skip(
    !fixturesEnabled,
    "Requires E2E_RCP_TOKEN, DATABASE_URL and E2E_ALLOW_DB_FIXTURES=1 for this test backend.",
  );
  const ids: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  try {
    await signIn(page);
    const a = await createFixture(page, "A");
    ids.push(a.id);
    const b = await createFixture(page, "B");
    ids.push(b.id);
    await seedEvidence(a.id);
    await page.goto(`/?chat=${a.id}`, { waitUntil: "domcontentloaded" });
    await openPanel(page);
    const panel = page.getByRole("region", { name: panelName, exact: true });
    const question = panel.getByRole("textbox", {
      name: "Your question",
      exact: true,
    });
    await expect(
      panel.getByRole("heading", { name: a.title, exact: true }),
    ).toBeVisible();
    await question.fill("An unsent draft");
    await question.press("Shift+Enter");
    await expect(question).toHaveValue("An unsent draft\n");
    await question.dispatchEvent("keydown", {
      key: "Enter",
      code: "Enter",
      isComposing: true,
    });
    await expect(question).toHaveValue("An unsent draft\n");
    await panel
      .getByRole("button", { name: "Edit question", exact: true })
      .click();
    await expect(
      panel.getByRole("textbox", {
        name: "Edit your last question",
        exact: true,
      }),
    ).toBeFocused();
    await panel
      .getByRole("button", { name: "Cancel edit", exact: true })
      .click();
    await expect(question).toHaveValue("An unsent draft\n");
    await page.reload({ waitUntil: "domcontentloaded" });
    await openPanel(page);
    await expect(question).toHaveValue("An unsent draft\n");
    await panel
      .getByRole("button", { name: "Show chat history", exact: true })
      .click();
    const history = page.getByRole("complementary", {
      name: "Chat history",
      exact: true,
    });
    await history.getByRole("link", { name: b.title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(b.id));
    await expect(history).toBeVisible();
    await expect(question).toBeEmpty();
    await history.getByRole("link", { name: a.title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(a.id));
    await expect(question).toHaveValue("An unsent draft\n");
    await history
      .getByRole("button", { name: `Actions for ${a.title}`, exact: true })
      .click();
    await history
      .getByRole("button", { name: "Pin to favourites", exact: true })
      .click();
    const pinned = history.getByRole("region", {
      name: "Pinned chats",
      exact: true,
    });
    await expect(
      pinned.getByRole("link", { name: a.title, exact: true }),
    ).toBeVisible();
    await pinned
      .getByRole("button", { name: `Actions for ${a.title}`, exact: true })
      .click();
    await pinned.getByRole("button", { name: "Rename", exact: true }).click();
    const rename = pinned.getByRole("textbox", {
      name: "Chat name",
      exact: true,
    });
    await expect(rename).toBeFocused();
    await rename.press("Escape");
    await expect(history).toBeVisible();
    await expect(rename).toHaveCount(0);
    await pinned
      .getByRole("button", { name: `Actions for ${a.title}`, exact: true })
      .click();
    await pinned.getByRole("button", { name: "Rename", exact: true }).click();
    const renamed = `${a.title} renamed`;
    await rename.fill(renamed);
    await rename.press("Enter");
    await expect(
      pinned.getByRole("link", { name: renamed, exact: true }),
    ).toBeVisible();
    await history
      .getByRole("button", { name: "Close chat history", exact: true })
      .click();
    const chart = panel.getByRole("figure");
    await expect(chart).toContainText(
      "Fixture Democrat +1.4 pp vs Fixture Republican",
    );
    const slider = chart.getByRole("slider", {
      name: "Chart observation date",
      exact: true,
    });
    await slider.focus();
    await slider.press("ArrowLeft");
    await expect(chart).toContainText("Lead unavailable");
    await slider.press("End");
    await expect(chart).toContainText("+0.3 pp");
    const evidence = panel.getByText(
      "MCP call · get_race_average_history · Completed",
      { exact: true },
    );
    await evidence.click();
    await expect(
      panel.getByRole("link", { name: /realclearpolling.com · source/ }),
    ).toBeVisible();
    await evidence.click();
    await panel
      .getByText("Technical metadata · Conversation totals", { exact: true })
      .click();
    await expect(
      panel.getByText(/Includes research, retries, replaced answers/),
    ).toBeVisible();
    await panel
      .getByText("Technical metadata · Conversation totals", { exact: true })
      .click();
    await panel
      .getByRole("button", { name: "Expand to full window", exact: true })
      .click();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await question.fill("Keep this draft after a rejected request");
    for (const [status, code, error] of [
      [429, "USER_RATE_LIMIT", "Too many requests. Please wait."],
      [503, "SERVICE_BUSY", "Service is experiencing unusually high load."],
    ] as const) {
      await page.route(
        "**/api/conversations/*/messages",
        (route) =>
          route.fulfill({
            status,
            headers: { "Retry-After": "2" },
            json: { code, error, retryAfter: 2, saved: false },
          }),
        { times: 1 },
      );
      await question.press("Enter");
      await expect(panel.getByRole("alert")).toContainText(error);
      await expect(question).toHaveValue(
        "Keep this draft after a rejected request",
      );
      await expect(
        panel.getByRole("button", { name: /Send question/ }),
      ).toBeDisabled();
      await expect(
        panel.getByRole("button", { name: /Send question/ }),
      ).toBeEnabled();
    }
    await page.screenshot({ path: testInfo.outputPath("mobile.png") });
    const sql = neon(process.env.DATABASE_URL!);
    await sql`UPDATE messages SET status='pending',generation_started_at=now() WHERE conversation_id=${a.id} AND role='assistant'`;
    await page.reload({ waitUntil: "domcontentloaded" });
    await openPanel(page);
    await expect(
      panel.getByRole("article", {
        name: "Research assistant response",
        exact: true,
      }),
    ).toHaveAttribute("data-status", "pending");
    await sql`UPDATE messages SET status='interrupted' WHERE conversation_id=${a.id} AND role='assistant'`;
    await expect(panel.getByRole("button", { name: /Retry/ })).toBeVisible();

    await panel.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(
      page.getByLabel("Your RCP MCP token", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await removeFixtures(ids);
  }
});
