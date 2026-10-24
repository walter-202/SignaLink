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
  "infrastructure/onnx-sequence-classifier",
  "application/ports/landmark-detector",
  "infrastructure/mediapipe-holistic-landmark-detector",
  "infrastructure/worker-landmark-detector",
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
      body: compiled.replace('import("onnxruntime-web/wasm")', 'import("/__recognition-test/ort.mjs")')
        .replace(/process\.env\.NEXT_PUBLIC_[A-Z_]+/g, "undefined"),
    });
  });
});

test("classic landmark Worker transfers an image and keeps the page responsive during synthetic compute", async ({ page, context }) => {
  // The worker entry and adapter are production code. Only the Vision engine is
  // synthetic: this verifies transport/lifecycle, not MediaPipe speed or accuracy.
  await context.route("**/mediapipe/1.1.1/vision_bundle.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `self.Vision = {
      FilesetResolver: { forVisionTasks: async () => ({}) },
      HolisticLandmarker: { createFromOptions: async () => ({ detectForVideo(bitmap) {
        if (bitmap.width !== 320 || bitmap.height !== 240) throw new Error('Image not transferred');
        const end = performance.now() + 250; while (performance.now() < end) {}
        return { poseLandmarks: [[{ x: 0.5, y: 0.2, z: 0, visibility: 1 }]], leftHandLandmarks: [], rightHandLandmarks: [] };
      } }) }
    };`,
  }));
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    const url = "/__recognition-test/infrastructure/worker-landmark-detector";
    const { WorkerLandmarkDetector } = await import(url) as typeof import("../../src/features/sign-recognition/infrastructure/worker-landmark-detector");
    const detector = new WorkerLandmarkDetector();
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 240;
    canvas.getContext("2d")!.fillRect(0, 0, 320, 240);
    const stream = canvas.captureStream(30);
    const video = document.createElement("video"); video.muted = true; video.srcObject = stream;
    let ticks = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      await video.play();
      await detector.initialize();
      timer = setInterval(() => ticks++, 10);
      const frame = await detector.detect(video, 123);
      return { frame, ticks, diagnostics: detector.diagnostics() };
    } finally {
      clearInterval(timer); detector.close(); stream.getTracks().forEach((track) => track.stop());
    }
  });
  expect(result.frame).toEqual({ timestampMs: 123, pose: [{ x: 0.5, y: 0.2, z: 0, visibility: 1 }], leftHand: null, rightHand: null });
  expect(result.ticks).toBeGreaterThan(2);
  expect(result.diagnostics.mode).toBe("worker");
  expect(result.diagnostics.workerMs).toBeGreaterThanOrEqual(240);
});

test("real local MediaPipe bundle and WASM bootstrap in the classic Worker and report an invalid task", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "A second emulated viewport is not another MediaPipe device benchmark.");
  test.setTimeout(90_000);
  let taskRequests = 0;
  let wasmRequests = 0;
  context.on("request", (request) => { if (request.url().includes("/mediapipe/wasm/") && request.url().endsWith(".wasm")) wasmRequests++; });
  await context.route("**/__invalid-holistic.task", (route) => {
    taskRequests++;
    return route.fulfill({ status: 404, body: "Task intentionally unavailable in bootstrap smoke test" });
  });
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    const worker = new Worker("/mediapipe/1.1.1/holistic-worker.js");
    try {
      return await new Promise<{ type: string; code?: string }>((resolve, reject) => {
        worker.onmessage = ({ data }) => resolve(data);
        worker.onerror = () => reject(new Error("Worker bootstrap failed"));
        worker.postMessage({ type: "initialize", wasmPath: new URL("/mediapipe/wasm", location.href).href, modelUrl: new URL("/__invalid-holistic.task", location.href).href });
      });
    } finally { worker.terminate(); }
  });
  expect(result).toEqual({ type: "error", code: "model-load" });
  expect(wasmRequests).toBeGreaterThan(0);
  expect(taskRequests).toBeGreaterThan(0);
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
      sequenceLength: 30,
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
    resolves[0]!({ label: "SYNTHETIC_1", confidence: 1, classIndex: 0, modelId: "test-model", modelVersion: "1.0.0", margin: 1, decision: "candidate" });
    await Promise.resolve();
    const callsAfterResolve = sequences.length;
    pipeline.stop();
    resolves[1]!({ label: "SYNTHETIC_2", confidence: 1, classIndex: 0, modelId: "test-model", modelVersion: "1.0.0", margin: 1, decision: "candidate" });
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
    const moduleUrl = "/__recognition-test/infrastructure/onnx-sequence-classifier";
    const catalogUrl = "/__recognition-test/domain/model-catalog";
    const { OnnxSequenceClassifier } = await import(moduleUrl) as typeof import("../../src/features/sign-recognition/infrastructure/onnx-sequence-classifier");
    const { LSB_REFERENCE_V4 } = await import(catalogUrl) as typeof import("../../src/features/sign-recognition/domain/model-catalog");
    const classifier = new OnnxSequenceClassifier(LSB_REFERENCE_V4);
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
    expect(prediction.modelId).toBe("lsb-reference-v4");
    expect(prediction.modelVersion).toBe("4.0.0");
    expect(["candidate", "uncertain"]).toContain(prediction.decision);
    expect(Number.isFinite(prediction.margin)).toBe(true);
    expect(prediction.classIndex).toBeGreaterThanOrEqual(0);
    expect(prediction.classIndex).toBeLessThan(58);
    expect(Number.isFinite(prediction.confidence)).toBe(true);
  }
  const reportPath = testInfo.outputPath("local-onnx-runtime-smoke.json");
  await writeFile(reportPath, JSON.stringify({ input: "synthetic-zero-tensor; no linguistic accuracy measured", initializeMs: result.initializeMs, coldInferenceMs: result.inferenceMs[0], warmInferenceMs: result.inferenceMs.slice(1) }, null, 2));
  await testInfo.attach("local-onnx-runtime-smoke.json", { contentType: "application/json", path: reportPath });
});
