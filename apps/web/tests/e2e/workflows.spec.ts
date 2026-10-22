import { expect, test } from "@playwright/test";

test("attention flow reviews a capture, sends a reply, and finalizes the session", async ({ page }) => {
  await page.goto("/atender");

  await page.getByRole("button", { name: "Capturar una seña simulada" }).click();
  const proposal = page.getByRole("textbox", { name: "Editar propuesta" });
  await expect(proposal).toBeVisible();
  await proposal.fill("Quiero consultar los requisitos.");
  await page.getByRole("button", { name: "Confirmar mensaje" }).click();
  await expect(page.getByRole("button", { name: /Quiero consultar los requisitos/ })).toBeVisible();

  await page.getByRole("textbox", { name: "Respuesta para la conversación" }).fill("Puede revisar los requisitos en esta oficina.");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByRole("button", { name: /Puede revisar los requisitos/ })).toBeVisible();

  await page.getByRole("button", { name: "Finalizar atención" }).click();
  await page.getByRole("button", { name: "Sí, finalizar" }).click();
  await expect(page.getByText("Atención finalizada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Capturar una seña simulada" })).toBeDisabled();
});

test("history filters records and confirms before reopening one", async ({ page }) => {
  await page.goto("/historial");

  await expect(page.getByText("18 resultados")).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar por referencia, trámite o conversación" }).fill("AT-2024-0017");
  await expect(page.getByText("1 resultados")).toBeVisible();
  await page.getByRole("button", { name: /AT-2024-0017/ }).click();
  await expect(page.getByRole("heading", { name: "Detalle de la atención" })).toBeVisible();

  await page.getByRole("button", { name: "Reabrir atención" }).click();
  await expect(page.getByRole("dialog", { name: "¿Reabrir esta atención?" })).toBeVisible();
  await page.getByRole("button", { name: "Reabrir atención" }).last().click();
  await expect(page).toHaveURL(/\/atender$/);
  await expect(page.getByText("Atención en curso")).toBeVisible();
});

test("mobile history uses cards without horizontal page overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Responsive card layout is covered by the mobile Chromium project.");
  await page.goto("/historial");

  await expect(page.locator(".history-mobile-card").first()).toBeVisible();
  await expect(page.locator(".history-table-wrap")).toBeHidden();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
