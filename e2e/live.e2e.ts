import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import {
  authenticated,
  openPanel,
  panelName,
  removeFixtures,
  signIn,
} from "./helpers";

test("Chrome: live MCP research, follow-up, title, edit, stop, retry and saved history", async ({
  page,
}) => {
  test.skip(
    !authenticated || process.env.E2E_LIVE !== "1" || !process.env.DATABASE_URL,
    "Opt-in live MCP/LLM calls require E2E_LIVE=1, E2E_RCP_TOKEN and this backend's DATABASE_URL.",
  );
  test.setTimeout(360_000);
  const ids: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  const sql = neon(process.env.DATABASE_URL!);
  try {
    await signIn(page);
    const panel = page.getByRole("region", { name: panelName, exact: true });
    const question = panel.getByRole("textbox", {
      name: "Your question",
      exact: true,
    });
    const responses = panel.getByRole("article", {
      name: "Research assistant response",
      exact: true,
    });
    const log = panel.getByRole("log", {
      name: "Conversation messages",
      exact: true,
    });
    async function completed(count: number) {
      await expect(responses).toHaveCount(count, { timeout: 100_000 });
      await expect(responses.last()).toHaveAttribute(
        "data-status",
        "complete",
        { timeout: 100_000 },
      );
      await expect(log).toHaveAttribute("aria-busy", "false");
      await expect(
        panel.getByRole("button", { name: "Send question", exact: true }),
      ).toBeVisible();
    }
    await test.step("real research and saved tool evidence", async () => {
      const created = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/conversations" &&
          r.request().method() === "POST",
      );
      await question.fill(
        "Find the latest published RCP average for the 2026 Maine Senate race. State its date and source in two sentences.",
      );
      await question.press("Enter");
      ids.push((await (await created).json()).id);
      await expect(
        panel.getByRole("button", { name: "Stop response", exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("status", {
          name: "Research in progress",
          exact: true,
        }),
      ).toBeVisible();
      await completed(1);
      await expect(page).toHaveURL(new RegExp(ids[0]));
      await expect(
        responses
          .first()
          .getByText(/MCP call ·/)
          .first(),
      ).toBeVisible();
      // Captured usage should include the native tool-search/sandbox steps.
      await expect
        .poll(
          async () =>
            (
              await sql`SELECT status FROM model_usage WHERE conversation_id=${ids[0]} AND kind='chat' ORDER BY created_at DESC LIMIT 1`
            )[0]?.status,
        )
        .toBe("complete");
    });
    await test.step("immediate follow-up preserves context", async () => {
      await question.fill(
        "Summarize that in one sentence using only the saved evidence. Do not retrieve anything again.",
      );
      await question.press("Enter");
      await completed(2);
      await expect(responses.last()).toContainText(
        /Maine|Senate|Collins|Jackson/i,
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await openPanel(page);
      await completed(2);
    });
    await test.step("title regeneration and last-message editing", async () => {
      await panel
        .getByRole("button", { name: "Show chat history", exact: true })
        .click();
      const history = page.getByRole("complementary", {
        name: "Chat history",
        exact: true,
      });
      const selected = history
        .getByRole("link")
        .and(history.locator('[aria-current="page"]'));
      const row = selected.locator("..");
      await row.getByRole("button", { name: /^Actions for/ }).click();
      const regenerated = page.waitForResponse(
        (r) => r.request().method() === "PATCH" && r.url().endsWith(ids[0]),
      );
      await row
        .getByRole("button", { name: "Regenerate title", exact: true })
        .click();
      expect((await regenerated).ok()).toBe(true);
      await history
        .getByRole("button", { name: "Close chat history", exact: true })
        .click();
      await panel
        .getByRole("button", { name: "Edit question", exact: true })
        .click();
      await panel
        .getByRole("textbox", { name: "Edit your last question", exact: true })
        .fill(
          "Using the saved evidence, give the latest average and its date in one short sentence.",
        );
      await panel
        .getByRole("button", { name: "Save and send", exact: true })
        .click();
      await completed(2);
      await expect(
        panel.getByRole("article", { name: "Your question", exact: true }),
      ).toHaveCount(2);
    });
    await test.step("Stop persists interruption; Retry completes", async () => {
      await question.fill(
        "Find Maine Senate polling average history for the last month and describe the observations.",
      );
      await question.press("Enter");
      const stop = panel.getByRole("button", {
        name: "Stop response",
        exact: true,
      });
      await expect(stop).toBeVisible();
      // Wait for the backend to accept and reserve the turn before stopping.
      await expect
        .poll(
          async () =>
            (
              await sql`SELECT status FROM messages WHERE conversation_id=${ids[0]} AND role='assistant' ORDER BY sequence DESC LIMIT 1`
            )[0]?.status,
        )
        .toBe("pending");
      await stop.click();
      await expect
        .poll(
          async () =>
            (
              await sql`SELECT status FROM messages WHERE conversation_id=${ids[0]} AND role='assistant' ORDER BY sequence DESC LIMIT 1`
            )[0]?.status,
          { timeout: 25_000 },
        )
        .toBe("interrupted");
      await expect(panel.getByRole("button", { name: /Retry/ })).toBeVisible();
      await panel.getByRole("button", { name: /Retry/ }).click();
      await completed(3);
    });
    await test.step("sign out and sign back in retains history", async () => {
      await panel
        .getByRole("button", { name: "Sign out", exact: true })
        .click();
      await expect(page).toHaveURL(/\/sign-in$/);
      await signIn(page);
      await panel
        .getByRole("button", { name: "Show chat history", exact: true })
        .click();
      // Conversation IDs are used only to identify this run's newly created chat.
      await page
        .getByRole("complementary", { name: "Chat history", exact: true })
        .locator(`a[href="/?chat=${ids[0]}"]`)
        .click();
      await completed(3);
      expect(errors).toEqual([]);
    });
  } finally {
    const stop = page.getByRole("button", {
      name: "Stop response",
      exact: true,
    });
    if (await stop.isVisible().catch(() => false))
      await stop.click().catch(() => {});
    await removeFixtures(ids);
  }
});
