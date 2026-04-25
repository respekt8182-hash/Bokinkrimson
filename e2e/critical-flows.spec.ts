// End-to-end test scenarios for critical guest and owner flows.
import { expect, test } from "@playwright/test";

const adminLogin = process.env.E2E_ADMIN_LOGIN ?? "admin";
// Keep the admin plaintext secret outside the repository and inject it only for e2e runs.
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("public search flows", () => {
  test("search housing -> open property card", async ({ page, request }) => {
    await page.goto("/search?direction=housing");
    await expect(page.locator("h1")).toContainText(
      /\u0416\u0438\u043b\u044c[\u0435\u0451]|\u041a\u0430\u0442\u0430\u043b\u043e\u0433 \u0436\u0438\u043b\u044c\u044f/i,
    );

    const response = await request.get("/api/public/properties?page=1&pageSize=1");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { items?: Array<{ path: string }> };
    const first = body.items?.[0];

    test.skip(
      !first,
      "\u041d\u0435\u0442 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0434\u043b\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438.",
    );
    if (!first) return;

    await page.goto(first.path);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("search excursions -> open excursion card", async ({ page, request }) => {
    await page.goto("/search?direction=excursions");
    await expect(page.locator("h1")).toContainText(
      /\u042d\u043a\u0441\u043a\u0443\u0440\u0441|\u0422\u0443\u0440/i,
    );

    const response = await request.get("/api/public/excursions?page=1&pageSize=1");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { items?: Array<{ path: string }> };
    const first = body.items?.[0];

    test.skip(
      !first,
      "\u041d\u0435\u0442 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u044d\u043a\u0441\u043a\u0443\u0440\u0441\u0438\u0439 \u0434\u043b\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438.",
    );
    if (!first) return;

    await page.goto(first.path);
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("owner->payment->moderation flow", () => {
  test("owner can log in with seeded legacy phone format", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("\u0422\u0435\u043b\u0435\u0444\u043e\u043d").fill("9990000001");
    await page.getByLabel("\u041f\u0430\u0440\u043e\u043b\u044c").fill("DemoContent!2026");
    await page.getByRole("button", { name: "\u0412\u043e\u0439\u0442\u0438" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /\u0413\u043b\u0430\u0432\u043d/,
    );
  });

  test("admin can log in even when admin session state table is unavailable", async ({ page }) => {
    test.skip(!adminPassword, "Set E2E_ADMIN_PASSWORD to run the admin login flow.");
    if (!adminPassword) return;

    await page.goto("/admin/login");
    await page.getByLabel("\u041b\u043e\u0433\u0438\u043d").fill(adminLogin);
    await page
      .getByPlaceholder(
        "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c",
      )
      .fill(adminPassword);
    await page.getByRole("button", { name: "\u0412\u043e\u0439\u0442\u0438" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /\u041e\u0431\u0437\u043e\u0440/,
    );
  });
});
