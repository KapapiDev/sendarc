import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page is responsive and accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Keep your old apps");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.locator("body").evaluate((body) => body.clientWidth));
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("navigation and legal routes resolve", async ({ page }) => {
  for (const path of ["/docs/", "/download/", "/privacy/", "/terms/", "/licenses/", "/security/", "/support/", "/affixa-alternative/"]) {
    const response = await page.goto(path);
    expect(response?.ok(), path).toBe(true);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("FAQ opens one answer at a time", async ({ page }) => {
  await page.goto("/");
  const items = page.locator("[data-faq-list] details");
  await items.nth(1).locator("summary").click();
  await expect(items.nth(1)).toHaveAttribute("open", "");
  await expect(items.nth(0)).not.toHaveAttribute("open", "");
});

test("Business Beta form posts only declared fields", async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/business-beta", async (route) => {
    payload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/");
  await page.getByLabel("Work email").fill("person@example.com");
  await page.getByLabel("Company name").fill("Example Co");
  await page.getByLabel("Approximate seats").selectOption("2-5");
  await page.getByLabel("Current workflow").selectOption("affixa");
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Join Business Beta" }).click();
  await expect(page.getByRole("status")).toContainText("recorded");
  expect(payload).toMatchObject({ email: "person@example.com", company: "Example Co", seats: "2-5", workflow: "affixa" });
});
