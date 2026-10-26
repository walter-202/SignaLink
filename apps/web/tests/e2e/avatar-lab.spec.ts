import { statSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("loads and plays the local V5 technical rig in the fixed-front lab", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const modelResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/avatars/signalink_avatar_v5_refined.glb",
  );

  await page.goto("/avatar-lab");
  await expect(page.getByRole("heading", { name: "Laboratorio de avatar 3D" })).toBeVisible();
  await expect(page.getByText("43 articulaciones · 1 skin")).toBeVisible();
  await expect(page.getByText("17 técnicos + 4 estudios provisionales", { exact: true })).toBeVisible();
  await expect(page.getByText("No LSB validado", { exact: false })).toBeVisible();

  const response = await modelResponse;
  expect(response.status()).toBe(200);
  expect((await response.body()).byteLength).toBe(statSync("public/avatars/signalink_avatar_v5_refined.glb").size);

  const clipPicker = page.getByLabel("Clip técnico");
  await expect(clipPicker.locator("option")).toHaveCount(21);
  await expect(clipPicker.locator("option", { hasText: "DEMO_ELBOW_STRESS" })).toHaveCount(1);
  await expect(page.getByTestId("avatar-lab-viewer").locator("canvas")).toBeVisible();
  const webglReady = await page.getByTestId("avatar-lab-viewer").locator("canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return canvas.width > 0 && canvas.height > 0
      && Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  });
  expect(webglReady).toBe(true);

  await clipPicker.selectOption("DEMO_ELBOW_STRESS");
  await page.getByRole("button", { name: "Reproducir clip" }).click();
  await expect(page.getByRole("button", { name: "Pausar clip" })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByRole("button", { name: "Pausar clip" })).toBeVisible();
  await page.getByRole("button", { name: "Pausar clip" }).click({ timeout: 8_000 });
  await expect(page.getByRole("button", { name: "Reproducir clip" })).toBeVisible();
  const canvas = page.getByTestId("avatar-lab-viewer").locator("canvas");
  await clipPicker.selectOption("DEMO_HEAD_TURN");
  const front = await canvas.screenshot();
  await page.getByLabel("Fotograma de inspección:", { exact: false }).fill("1.2");
  await page.waitForTimeout(200);
  expect((await canvas.screenshot()).equals(front)).toBe(false);
  for (const clip of ["DEMO_FIST", "DEMO_WRIST_FLEX", "DEMO_EYE_BLINK", "HOLA", "QA_DACTILO_A", "QA_DACTILO_B", "QA_DACTILO_L"]) {
    await clipPicker.selectOption(clip);
    await page.getByLabel("Fotograma de inspección:", { exact: false }).fill("0.8");
    await expect(canvas).toBeVisible();
  }
  await page.screenshot({ path: test.info().outputPath("v5-refined-dactilo-l.png") });
  await page.getByRole("button", { name: "Detener", exact: true }).click();
  await expect(page.getByLabel("Fotograma de inspección:", { exact: false })).toHaveValue("0");
  expect(pageErrors).toEqual([]);
});
