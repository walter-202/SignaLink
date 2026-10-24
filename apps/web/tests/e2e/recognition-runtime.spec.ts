import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { expect, test } from "@playwright/test";

// Serve the actual application modules through Playwright interception only.
// No public test page, auth bypass, extra server or copied model artifacts.
const modules = [
  "application/continuous-recognition-pipeline",
  "application/continuous-sign-segmenter",
  "application/recognition-performance",
  "infrastructure/onnx-lsb-classifier",
  "domain/landmarks",
  "domain/model-catalog",
];

test.beforeEach(async ({ page }) => {
  await page.route("**/__recognition-test/**", async (route) => {
    const name = new URL(route.request().url()).pathname.replace("/__recognition-test/", "");
    if (name === "ort.mjs") {
      await route.fulfill({ contentType: "text/javascript", body: await readFile(path.resolve("node_modules/onnxruntime-web/dist/ort.wasm.min.mjs")) });
      return;
    }
    if (!modules.includes(name)) {
      await route.fulfill({ status: 404, body: "Unknown test module" });
      return;
    }
    const source = await readFile(path.resolve("src/features/sign-recognition", `${name}.ts`), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    await route.fulfill({
      contentType: "text/javascript",
      body: compiled.replace('import("onnxruntime-web/wasm")', 'import("/__recognition-test/ort.mjs")'),
    });
  });
});

test("browser pipeline captures during slow synthetic inference and cancels late results", async ({ page }) => {
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    const pipelineUrl = "/__recognition-test/application/continuous-recognition-pipeline";
    const metricsUrl = "/__recognition-test/application/recognition-performance";
    const { ContinuousRecognitionPipeline } = await import(pipelineUrl) as typeof import("../../src/features/sign-recognition/application/continuous-recognition-pipeline");
    const { RecognitionPerformance } = await import(metricsUrl) as typeof import("../../src/features/sign-recognition/application/recognition-performance");
    type Prediction = import("../../src/features/sign-recognition/application/ports/sign-classifier").SignClassification;
    let now = 0;
    let position = 0.1;
    const sequences: number[] = [];
    const resolves: Array<(value: Prediction) => void> = [];
    const labels: string[] = [];
    const metrics = new RecognitionPerformance();
    const pipeline = new ContinuousRecognitionPipeline({
      classifier: {
        initialize: async () => undefined,
        close: () => undefined,
        classify: (sequence) => {
          sequences.push(sequence.length);
          return new Promise<Prediction>((resolve) => resolves.push(resolve));
        },
      },
      performance: metrics,
      now: () => now,
      onProgress: () => undefined,
      onProcessing: () => undefined,
      onError: (message) => { throw new Error(message); },
      onPrediction: ({ label }) => labels.push(label),
    });
    function push() {
      now += 33;
      pipeline.push({ timestampMs: now, pose: null, leftHand: null, rightHand: Array.from({ length: 21 }, () => ({ x: position, y: 0.2, z: 0 })) }, new Float32Array(138));
    }
    function feed() {
      for (let i = 0; i < 14; i++) push();
      position += 0.03; push();
      position += 0.03; push();
      for (let i = 0; i < 28; i++) push();
    }
    pipeline.start();
    feed(); feed();
    const callsWhileBusy = sequences.length;
    resolves[0]!({ label: "SYNTHETIC_1", confidence: 1, classIndex: 0 });
    await Promise.resolve();
    const callsAfterResolve = sequences.length;
    pipeline.stop();
    resolves[1]!({ label: "SYNTHETIC_2", confidence: 1, classIndex: 0 });
    await Promise.resolve();
    return { sequences, labels, callsWhileBusy, callsAfterResolve, measurements: metrics.snapshot() };
  });
  expect(result.callsWhileBusy).toBe(1);
  expect(result.callsAfterResolve).toBe(2);
  expect(result.sequences).toEqual([30, 30]);
  expect(result.labels).toEqual(["SYNTHETIC_1"]);
  expect(result.measurements.timings.observationMs?.total).toBe(2);
});

test("real LSB ONNX loads locally with integrity verification and runs in browser WASM", async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, "Device emulation does not provide an independent mobile CPU benchmark.");
  test.setTimeout(90_000);
  let downloads = 0;
  page.on("request", (request) => {
    if (request.url().includes("model_transformer_enco_v4.onnx")) downloads++;
  });
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    const moduleUrl = "/__recognition-test/infrastructure/onnx-lsb-classifier";
    const { OnnxLsbReferenceClassifier } = await import(moduleUrl) as typeof import("../../src/features/sign-recognition/infrastructure/onnx-lsb-classifier");
    const classifier = new OnnxLsbReferenceClassifier();
    const startedAt = performance.now();
    await classifier.initialize(); // Includes the production SHA-256 check.
    const initializeMs = performance.now() - startedAt;
    await classifier.initialize(); // Reuse the same session; do not download again.
    const sequence = Array.from({ length: 30 }, () => new Float32Array(138));
    const inferenceMs: number[] = [];
    const predictions = [];
    try {
      for (let i = 0; i < 6; i++) {
        const startedAt = performance.now();
        predictions.push(await classifier.classify(sequence));
        inferenceMs.push(performance.now() - startedAt);
      }
    } finally {
      classifier.close();
    }
    return { initializeMs, inferenceMs, predictions };
  });
  expect(downloads).toBe(1);
  expect(result.predictions).toHaveLength(6);
  for (const prediction of result.predictions) {
    expect(prediction.classIndex).toBeGreaterThanOrEqual(0);
    expect(prediction.classIndex).toBeLessThan(58);
    expect(Number.isFinite(prediction.confidence)).toBe(true);
  }
  const reportPath = testInfo.outputPath("local-onnx-runtime-smoke.json");
  await writeFile(reportPath, JSON.stringify({ input: "synthetic-zero-tensor; no linguistic accuracy measured", initializeMs: result.initializeMs, coldInferenceMs: result.inferenceMs[0], warmInferenceMs: result.inferenceMs.slice(1) }, null, 2));
  await testInfo.attach("local-onnx-runtime-smoke.json", { contentType: "application/json", path: reportPath });
});
