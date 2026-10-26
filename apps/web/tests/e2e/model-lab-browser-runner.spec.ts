import { open, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { expect, test } from "@playwright/test";
import { compareRuns } from "../../../../model-lab/src/evaluation/compare-runs.mjs";
import { evaluateRun } from "../../../../model-lab/src/evaluation/evaluate-run.mjs";
import { loadRunnerInputs, writePrivateComparison, writePrivateRun } from "../../../../model-lab/src/browser/runner-config.mjs";

test.use({ trace: "off", screenshot: "off", video: "off" });
test("runs the real LSB pipeline against private authorized clips and writes local ledgers", async ({ page, context, browser }) => {
  const configPath = process.env.SIGNALINK_MODEL_LAB_RUNNER_CONFIG;
  test.skip(!configPath, "El runner real requiere un manifiesto privado y modelos locales verificados.");
  test.setTimeout(7_200_000);

  const repoRoot = path.resolve(process.cwd(), "../..");
  const inputs = await loadRunnerInputs(configPath!, repoRoot);
  const base = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100");
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== base.origin) {
      await route.abort();
      return;
    }
    await route.continue();
  });

  const sourceRoot = path.join(repoRoot, "apps", "web");
  const moduleSources: Record<string, string> = {
    "sign-recognition/application/continuous-recognition-pipeline": "src/features/sign-recognition/application/continuous-recognition-pipeline.ts",
    "sign-recognition/application/continuous-sign-segmenter": "src/features/sign-recognition/application/continuous-sign-segmenter.ts",
    "sign-recognition/application/recognition-performance": "src/features/sign-recognition/application/recognition-performance.ts",
    "sign-recognition/application/model-capture-policy": "src/features/sign-recognition/application/model-capture-policy.ts",
    "sign-recognition/application/ports/landmark-detector": "src/features/sign-recognition/application/ports/landmark-detector.ts",
    "sign-recognition/domain/landmarks": "src/features/sign-recognition/domain/landmarks.ts",
    "sign-recognition/domain/model-catalog": "src/features/sign-recognition/domain/model-catalog.ts",
    "sign-recognition/domain/holistic-model-asset": "src/features/sign-recognition/domain/holistic-model-asset.ts",
    "sign-recognition/infrastructure/holistic-model-asset": "src/features/sign-recognition/infrastructure/holistic-model-asset.ts",
    "sign-recognition/infrastructure/mediapipe-holistic-landmark-detector": "src/features/sign-recognition/infrastructure/mediapipe-holistic-landmark-detector.ts",
    "sign-recognition/infrastructure/worker-landmark-detector": "src/features/sign-recognition/infrastructure/worker-landmark-detector.ts",
    "sign-recognition/infrastructure/onnx-sequence-classifier": "src/features/sign-recognition/infrastructure/onnx-sequence-classifier.ts",
    "attention/application/sign-transcript": "src/features/attention/application/sign-transcript.ts",
  };
  const sourceCache = new Map<string, string>();
  await page.route("**/__model-lab/modules/**", async (route) => {
    const name = new URL(route.request().url()).pathname.replace("/__model-lab/modules/", "");
    if (name === "onnxruntime.mjs" || name === "mediapipe-vision.mjs") {
      const modulePath = name === "onnxruntime.mjs"
        ? path.join(sourceRoot, "node_modules/onnxruntime-web/dist/ort.wasm.min.mjs")
        : path.join(sourceRoot, "node_modules/@mediapipe/tasks-vision/vision_bundle.mjs");
      const body = sourceCache.get(name) ?? await readFile(modulePath, "utf8");
      sourceCache.set(name, body);
      await route.fulfill({ contentType: "text/javascript", body });
      return;
    }
    const relative = moduleSources[name];
    if (!relative) {
      await route.fulfill({ status: 404, body: "Unknown local evaluation module" });
      return;
    }
    let body = sourceCache.get(name);
    if (!body) {
      const source = await readFile(path.join(sourceRoot, relative), "utf8");
      body = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
        .replaceAll('import("onnxruntime-web/wasm")', 'import("/__model-lab/modules/onnxruntime.mjs")')
        .replaceAll('import("@mediapipe/tasks-vision")', 'import("/__model-lab/modules/mediapipe-vision.mjs")')
        .replace(/process\.env\.NEXT_PUBLIC_[A-Z0-9_]+/g, "undefined");
      sourceCache.set(name, body);
    }
    await route.fulfill({ contentType: "text/javascript", body });
  });

  const activeClipFiles = inputs.clips;
  await page.route("**/__model-lab/clip/*", async (route) => {
    const clipId = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    const clipFile = activeClipFiles.get(clipId);
    if (!clipFile) {
      await route.fulfill({ status: 404, body: "Clip unavailable" });
      return;
    }
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : clipFile.bytes - 1, clipFile.bytes - 1);
      if (start >= clipFile.bytes || end < start) {
        await route.fulfill({ status: 416, headers: { "Content-Range": `bytes */${clipFile.bytes}` } });
        return;
      }
      const handle = await open(clipFile.path, "r");
      const body = Buffer.alloc(end - start + 1);
      try { await handle.read(body, 0, body.length, start); } finally { await handle.close(); }
      await route.fulfill({ status: 206, headers: {
        "Accept-Ranges": "bytes", "Content-Length": String(body.length),
        "Content-Range": `bytes ${start}-${end}/${clipFile.bytes}`, "Content-Type": clipFile.contentType,
      }, body });
      return;
    }
    await route.fulfill({ status: 200, headers: {
      "Accept-Ranges": "bytes", "Content-Length": String(clipFile.bytes), "Content-Type": clipFile.contentType,
    }, body: await readFile(clipFile.path) });
  });

  await page.goto("/login");
  const corpusClips = inputs.corpus.clips.filter((clip: { split: string }) => clip.split === "test");
  const browserVersion = browser.version().replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 24);
  const execution = await page.evaluate(async (input) => {
    const importModule = async <T>(name: string) => await import(`/__model-lab/modules/${name}`) as T;
    const [{ ContinuousRecognitionPipeline }, { RecognitionPerformance }, { decideModelCapture },
      { extractLsbFeatures }, { LSB_REFERENCE_V4 }, { OnnxSequenceClassifier },
      { MediaPipeHolisticLandmarkDetector }, { WorkerLandmarkDetector },
      { defineHolisticModelAsset }, { appendRecognizedLabel, isCharacterLabel }] = await Promise.all([
      importModule<typeof import("../../src/features/sign-recognition/application/continuous-recognition-pipeline")>("sign-recognition/application/continuous-recognition-pipeline"),
      importModule<typeof import("../../src/features/sign-recognition/application/recognition-performance")>("sign-recognition/application/recognition-performance"),
      importModule<typeof import("../../src/features/sign-recognition/application/model-capture-policy")>("sign-recognition/application/model-capture-policy"),
      importModule<typeof import("../../src/features/sign-recognition/domain/landmarks")>("sign-recognition/domain/landmarks"),
      importModule<typeof import("../../src/features/sign-recognition/domain/model-catalog")>("sign-recognition/domain/model-catalog"),
      importModule<typeof import("../../src/features/sign-recognition/infrastructure/onnx-sequence-classifier")>("sign-recognition/infrastructure/onnx-sequence-classifier"),
      importModule<typeof import("../../src/features/sign-recognition/infrastructure/mediapipe-holistic-landmark-detector")>("sign-recognition/infrastructure/mediapipe-holistic-landmark-detector"),
      importModule<typeof import("../../src/features/sign-recognition/infrastructure/worker-landmark-detector")>("sign-recognition/infrastructure/worker-landmark-detector"),
      importModule<typeof import("../../src/features/sign-recognition/infrastructure/holistic-model-asset")>("sign-recognition/infrastructure/holistic-model-asset"),
      importModule<typeof import("../../src/features/attention/application/sign-transcript")>("attention/application/sign-transcript"),
    ]);
    const corpusLabelIds = new Set(input.corpusLabelIds as string[]);
    const mapValues = Object.values(input.modelLabelMap as Record<string, string>);
    if (Object.keys(input.modelLabelMap).some((label) => !LSB_REFERENCE_V4.labels.includes(label as never))
      || mapValues.some((labelId) => !corpusLabelIds.has(labelId))
      || [...corpusLabelIds].some((labelId) => !mapValues.includes(labelId))) throw new Error("invalid-model-label-map");

    const container = document.createElement("main");
    container.setAttribute("aria-label", "Evaluación local de propuestas de señas");
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.preload = "auto";
    video.style.cssText = "display:block;width:min(640px,90vw);height:auto;background:#111";
    const label = document.createElement("label");
    label.htmlFor = "model-lab-proposal"; label.textContent = "Propuesta editable";
    const proposal = document.createElement("textarea");
    proposal.id = "model-lab-proposal"; proposal.setAttribute("aria-label", "Propuesta editable");
    proposal.maxLength = 500; proposal.style.cssText = "display:block;width:min(640px,90vw);min-height:4rem";
    container.append(video, label, proposal); document.body.append(container);

    const metrics = new RecognitionPerformance();
    const classifier = new OnnxSequenceClassifier(LSB_REFERENCE_V4, metrics);
    let classifierReady = false;
    try { await classifier.initialize(); classifierReady = true; } catch { /* Ledger all affected clips as errors below. */ }
    const asset = defineHolisticModelAsset(input.holistic);
    const detectors = new Map<string, { detector: InstanceType<typeof MediaPipeHolisticLandmarkDetector> | InstanceType<typeof WorkerLandmarkDetector>; diagnostics: () => Record<string, unknown>; failure: boolean }>();
    for (const mode of ["main-thread", "worker"] as const) {
      const detector = mode === "worker"
        ? new WorkerLandmarkDetector(asset)
        : new MediaPipeHolisticLandmarkDetector({ modelAsset: asset, wasmPath: "/mediapipe/wasm" });
      let failure = false;
      try { await detector.initialize(); } catch { failure = true; }
      detectors.set(mode, { detector, diagnostics: detector.diagnostics, failure });
    }

    async function nextPaint() {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    function waitForMedia(event: string, timeoutMs: number): Promise<void> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("media-timeout")), timeoutMs);
        const clean = () => { clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener("error", failed); };
        const done = () => { clean(); resolve(); };
        const failed = () => { clean(); reject(new Error("media-decode")); };
        video.addEventListener(event, done, { once: true }); video.addEventListener("error", failed, { once: true });
      });
    }

    async function measureClip(mode: "main-thread" | "worker", clip: (typeof input.clips)[number]) {
      const result = { clipId: clip.id, status: "error" as "completed" | "error", observedUntilMs: 0, proposals: [] as Array<{ labelId: string; visibleAtMs: number }> };
      const selected = detectors.get(mode)!;
      if (!classifierReady || selected.failure || !selected.detector.isReady()) return result;
      let failure = false;
      let visibleText = "";
      let lastCharacter = false;
      let lastAccepted: { label: string; at: number } | null = null;
      let origin = 0;
      let inferencePending = false;
      let detectionPending = false;
      let detectionPromise: Promise<void> = Promise.resolve();
      let uiQueue = Promise.resolve();
      let lastVisibleAtMs = -1;
      let lastDetectionAt = Number.NEGATIVE_INFINITY;
      let lastVideoTime = -1;
      let lastTimestamp = 0;
      let callbackId: number | null = null;
      let active = true;
      let disposed = false;
      const frameIntervalMs = LSB_REFERENCE_V4.frameIntervalMs;
      const pipeline = new ContinuousRecognitionPipeline({
        classifier, sequenceLength: LSB_REFERENCE_V4.inputShape[1], performance: metrics,
        onProgress: () => undefined,
        onProcessing: () => { inferencePending = true; },
        onPrediction: (prediction) => {
          inferencePending = false;
          const at = performance.now();
          const decision = decideModelCapture(prediction, LSB_REFERENCE_V4, lastAccepted, at, 900);
          if (decision.kind !== "accepted") {
            if (decision.kind === "model-mismatch") failure = true;
            return;
          }
          lastAccepted = decision.next;
          visibleText = appendRecognizedLabel(visibleText, prediction.label, lastCharacter).slice(0, 500);
          lastCharacter = isCharacterLabel(prediction.label);
          const labelId = (input.modelLabelMap as Record<string, string>)[prediction.label] ?? "out-of-scope";
          proposal.value = visibleText;
          proposal.dispatchEvent(new Event("input", { bubbles: true }));
          uiQueue = uiQueue.then(async () => {
            await nextPaint();
            const elapsed = Math.max(0, performance.now() - origin);
            lastVisibleAtMs = Math.max(elapsed, lastVisibleAtMs + 0.001);
            result.proposals.push({ labelId, visibleAtMs: lastVisibleAtMs });
          });
        },
        onError: (_message, code) => {
          inferencePending = false;
          if (code !== "missing-hands") failure = true;
        },
      });
      const source = `/__model-lab/clip/${encodeURIComponent(clip.id)}?sample=${crypto.randomUUID()}`;
      video.pause(); video.removeAttribute("src"); video.load(); proposal.value = "";
      video.src = source;
      try {
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) await waitForMedia("loadedmetadata", 15_000);
        if (!Number.isFinite(video.duration) || Math.abs(video.duration * 1_000 - clip.durationMs) > 250) throw new Error("clip-duration-mismatch");
        video.currentTime = 0;
        const schedule = () => { callbackId = video.requestVideoFrameCallback(onFrame); };
        const onFrame = (now: number, metadata: VideoFrameCallbackMetadata) => {
          if (!active) return;
          schedule();
          if (origin === 0) origin = metadata.expectedDisplayTime - metadata.mediaTime * 1_000;
          if (document.hidden || now - lastDetectionAt < frameIntervalMs || detectionPending
            || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0
            || video.currentTime === lastVideoTime) return;
          lastDetectionAt = now; lastVideoTime = video.currentTime; detectionPending = true;
          const detectionStartedAt = performance.now();
          const timestamp = Math.max(lastTimestamp + 1, Math.round(performance.now())); lastTimestamp = timestamp;
          detectionPromise = Promise.resolve().then(() => selected.detector.detect(video, timestamp)).then((frame) => {
            if (disposed || document.hidden || performance.now() - detectionStartedAt > 1_000) return;
            pipeline.push(frame, extractLsbFeatures(frame));
          }).catch(() => { failure = true; }).finally(() => { detectionPending = false; });
        };
        pipeline.start(); schedule();
        const ended = waitForMedia("ended", clip.durationMs + 10_000);
        await Promise.all([video.play(), ended]);
        active = false;
        if (callbackId !== null) video.cancelVideoFrameCallback(callbackId);
        await detectionPromise;
        const tailEnd = performance.now() + 2_000;
        while (inferencePending && performance.now() < tailEnd) await new Promise((resolve) => setTimeout(resolve, 20));
        if (inferencePending) failure = true;
        await uiQueue;
        await nextPaint();
        result.observedUntilMs = Math.ceil(performance.now() - origin);
        if (result.observedUntilMs < clip.durationMs || result.observedUntilMs > clip.durationMs + 5_000) failure = true;
        result.status = failure ? "error" : "completed";
      } catch {
        active = false;
        if (callbackId !== null) video.cancelVideoFrameCallback(callbackId);
        result.observedUntilMs = origin > 0 ? Math.min(clip.durationMs + 5_000, Math.max(0, Math.ceil(performance.now() - origin))) : 0;
      } finally {
        disposed = true; pipeline.stop(); video.pause();
      }
      return result;
    }

    const arms: Array<{ runId: string; mode: "main-thread" | "worker"; condition: "warm"; delegate: "CPU" | "GPU" | "unknown"; results: Awaited<ReturnType<typeof measureClip>>[] }> = input.runs.map((run) => {
      const diagnostics = detectors.get(run.landmarkRuntime)!.diagnostics();
      return { runId: run.runId, mode: run.landmarkRuntime, condition: run.condition,
        delegate: (diagnostics.delegate === "CPU" || diagnostics.delegate === "GPU" ? diagnostics.delegate : "unknown"), results: [] };
    });
    const byMode = new Map(arms.map((arm) => [arm.mode, arm]));
    for (let index = 0; index < input.clips.length; index += 1) {
      const clip = input.clips[index]!;
      const order = index % 2 === 0 ? ["main-thread", "worker"] as const : ["worker", "main-thread"] as const;
      for (const mode of order) {
        const arm = byMode.get(mode)!;
        arm.results.push(await measureClip(mode, clip));
      }
    }
    for (const selected of detectors.values()) selected.detector.close();
    classifier.close(); container.remove();
    return {
      arms,
      model: {
        id: LSB_REFERENCE_V4.id, version: LSB_REFERENCE_V4.version, sha256: LSB_REFERENCE_V4.sha256,
        inputShape: [...LSB_REFERENCE_V4.inputShape], frameIntervalMs: LSB_REFERENCE_V4.frameIntervalMs,
        confidenceThreshold: LSB_REFERENCE_V4.confidenceThreshold, minimumMargin: LSB_REFERENCE_V4.minimumMargin,
        featureSchema: LSB_REFERENCE_V4.featureSchema, preprocessorId: LSB_REFERENCE_V4.preprocessorId,
      },
    };
  }, {
    holistic: inputs.holistic,
    modelLabelMap: inputs.config.modelLabelMap,
    corpusLabelIds: inputs.corpus.labels.map((label: { id: string }) => label.id),
    runs: inputs.config.runs,
    clips: corpusClips.map((clip: { id: string; durationMs: number }) => ({ id: clip.id, durationMs: clip.durationMs })),
  });

  const modelLabels = new Set<string>([...Object.values(inputs.config.modelLabelMap), "out-of-scope"]);
  const runRecords: Array<Record<string, unknown>> = [];
  for (const arm of execution.arms) {
    const run = {
      schemaVersion: 1,
      datasetId: inputs.corpus.datasetId,
      corpusSha256: inputs.corpusSha256,
      split: "test",
      evidence: inputs.corpus.evidence,
      runId: arm.runId,
      model: {
        id: execution.model.id, version: execution.model.version, sha256: execution.model.sha256,
        trainingParticipantAudit: "unknown", labelIds: [...modelLabels],
      },
      pipeline: {
        version: "continuous-v2", codeRevision: inputs.codeRevision,
        featureSchema: execution.model.featureSchema, preprocessorId: execution.model.preprocessorId, inputShape: execution.model.inputShape,
        frameIntervalMs: execution.model.frameIntervalMs, confidenceThreshold: execution.model.confidenceThreshold, minimumMargin: execution.model.minimumMargin,
        landmarkModelSha256: inputs.holistic.sha256, landmarkRuntime: arm.mode, delegate: arm.delegate, classifierRuntime: "onnx-wasm",
      },
      deviceProfileId: inputs.config.deviceProfileId,
      browserProfileId: `${inputs.config.browserProfileId}-${browserVersion}`.slice(0, 64),
      condition: arm.condition,
      clock: "realtime-clip-start-ms",
      results: arm.results,
    };
    evaluateRun(inputs.corpus, run);
    await writePrivateRun(repoRoot, arm.runId, run);
    runRecords.push(run);
  }
  const baselinePlan = inputs.config.runs.find((run) => run.landmarkRuntime === "main-thread")!;
  const candidatePlan = inputs.config.runs.find((run) => run.landmarkRuntime === "worker")!;
  const baselineRun = runRecords.find((run) => run.runId === baselinePlan.runId)!;
  const candidateRun = runRecords.find((run) => run.runId === candidatePlan.runId)!;
  const comparison = compareRuns(inputs.corpus, baselineRun, candidateRun);
  await writePrivateComparison(repoRoot, baselinePlan.runId, candidatePlan.runId, comparison);
  expect(execution.arms).toHaveLength(2);
  expect(execution.arms.every((arm) => arm.results.length === corpusClips.length)).toBe(true);
  expect(execution.arms.every((arm) => arm.results.every((result) => result.status === "completed"))).toBe(true);
});
