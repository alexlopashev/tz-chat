import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Chrome: launcher, keyboard resize, sign-in and accessibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/sign-in$/);
  const panel = page.getByRole("region", {
    name: "Polling research assistant",
    exact: true,
  });
  await expect(panel).toBeHidden();
  const launcher = page.getByRole("button", {
    name: "RCP + AI — Open chat",
    exact: true,
  });
  await launcher.focus();
  await launcher.press("Enter");
  await expect(panel).toBeVisible();
  const token = page.getByLabel("Your RCP MCP token", { exact: true });
  await token.fill("synthetic-visible-token");
  await page.getByRole("button", { name: "Show token", exact: true }).click();
  await expect(token).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide token", exact: true }).click();
  await expect(token).toHaveAttribute("type", "password");
  await page.route("**/api/auth/sign-in", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "This token is not valid. Check it and try again." },
    }),
  );
  await page.getByRole("button", { name: /Connect and continue/ }).click();
  await expect(panel.getByRole("alert")).toContainText("not valid");
  await token.clear();
  const separator = page.getByRole("separator", { name: "Resize chat panel" });
  await separator.focus();
  await separator.press("End");
  await expect(panel).toHaveAttribute("data-expanded", "true");
  await separator.press("Home");
  await expect(panel).toHaveAttribute("data-expanded", "false");
  await page
    .getByRole("button", { name: "Minimize chat", exact: true })
    .click();
  await expect(launcher).toBeFocused();
  await expect(panel).toBeHidden();
  await launcher.click();
  await page
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
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(token).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("link[data-animated-favicon]")).toHaveCount(0);
  expect(errors).toEqual([]);
});
