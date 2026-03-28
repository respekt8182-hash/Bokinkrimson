// End-to-end test scenarios for critical guest and owner flows.
import { expect, test } from "@playwright/test";

test.describe("public search flows", () => {
  test("search housing -> open property card", async ({ page, request }) => {
    await page.goto("/search?direction=housing");
    await expect(page.getByRole("heading", { name: "Каталог жилья в Крыму" })).toBeVisible();

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
    await expect(page.getByRole("heading", { name: "Каталог экскурсий в Крыму" })).toBeVisible();

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
  test("scenario scaffold", async () => {
    test.skip(
      true,
      "Для полноценного E2E нужно тестовое окружение с seeded данными и admin/owner аккаунтами.",
    );
  });
});
