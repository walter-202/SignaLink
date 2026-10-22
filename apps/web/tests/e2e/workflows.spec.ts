import { expect, test } from "@playwright/test";

test("workspace routes require an authenticated staff account", async ({ page }) => {
  await page.goto("/atender");
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByRole("heading", { name: "La Voz de tus Manos" })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByText("no hay registro público", { exact: false })).toBeVisible();

  await page.goto("/historial");
  await expect(page).toHaveURL(/\/login\?/);
});

test("login screen is usable on mobile without horizontal overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile viewport is covered by the mobile Chromium project.");
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "La Voz de tus Manos" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
