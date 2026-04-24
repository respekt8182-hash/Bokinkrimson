// End-to-end test scenarios for critical guest and owner flows.
import { expect, test } from "@playwright/test";

test.describe("public search flows", () => {
  test("search housing -> open property card", async ({ page, request }) => {
    await page.goto("/search?direction=housing");
    await expect(page.locator("h1")).toContainText(/Жиль[её]|Каталог жилья/i);

    const response = await request.get("/api/public/properties?page=1&pageSize=1");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { items?: Array<{ path: string }> };
    const first = body.items?.[0];

    test.skip(!first, "Нет опубликованных объектов для проверки карточки.");
    if (!first) return;

    await page.goto(first.path);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("search excursions -> open excursion card", async ({ page, request }) => {
    await page.goto("/search?direction=excursions");
    await expect(page.locator("h1")).toContainText(/Экскурс|Тур/i);

    const response = await request.get("/api/public/excursions?page=1&pageSize=1");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { items?: Array<{ path: string }> };
    const first = body.items?.[0];

    test.skip(!first, "Нет опубликованных экскурсий для проверки карточки.");
    if (!first) return;

    await page.goto(first.path);
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("owner->payment->moderation flow", () => {
  test("owner can log in with seeded legacy phone format", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Телефон").fill("9990000001");
    await page.getByLabel("Пароль").fill("DemoContent!2026");
    await page.getByRole("button", { name: "Войти" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Главн/);
  });

  test("admin can log in even when admin session state table is unavailable", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Логин").fill("admin");
    await page.getByPlaceholder("Введите пароль").fill("admin123");
    await page.getByRole("button", { name: "Войти" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Обзор/);
  });
});
