import { expect, it, vi } from "vitest";
import type { LandmarkDetector } from "../application/ports/landmark-detector";
import { BrowserLandmarkDetector } from "./browser-landmark-detector";
import { LandmarkDetectorError } from "../application/ports/landmark-detector";

function setup() {
  const main: LandmarkDetector = { initialize: vi.fn(async () => undefined), detect: vi.fn(), close: vi.fn(), isReady: () => true, diagnostics: () => ({ mode: "main-thread", delegate: "GPU" }) };
  const worker: LandmarkDetector = { ...main, initialize: vi.fn(async () => undefined), close: vi.fn(), diagnostics: () => ({ mode: "worker", delegate: "CPU" }) };
  const options = { preferWorker: true, workerSupported: () => true, createWorker: vi.fn(() => worker), createMain: vi.fn(() => main) };
  return { main, worker, options, detector: new BrowserLandmarkDetector(options) };
}

it("keeps the baseline when not opted in and uses main-thread mode if unsupported", async () => {
  const test = setup();
  test.options.preferWorker = false;
  test.detector = new BrowserLandmarkDetector(test.options);
  await test.detector.initialize();
  expect(test.options.createWorker).not.toHaveBeenCalled();
  expect(test.detector.diagnostics()).toEqual({ mode: "main-thread", delegate: "GPU", fallback: undefined });
  test.detector.close();
  const unsupported = setup();
  unsupported.options.workerSupported = () => false;
  unsupported.detector = new BrowserLandmarkDetector(unsupported.options);
  await unsupported.detector.initialize();
  expect(unsupported.detector.diagnostics().fallback).toBe("unsupported");
  expect(unsupported.options.createWorker).not.toHaveBeenCalled();
  unsupported.detector.close();
});

it("uses Worker when available and falls back only during initialization", async () => {
  const test = setup();
  await test.detector.initialize();
  expect(test.detector.diagnostics().mode).toBe("worker");
  expect(test.options.createMain).not.toHaveBeenCalled();
  test.detector.close();
  const failure = setup();
  vi.mocked(failure.worker.initialize).mockRejectedValue(new Error("unsupported GPU"));
  await failure.detector.initialize();
  expect(failure.worker.close).toHaveBeenCalledOnce();
  expect(failure.main.initialize).toHaveBeenCalledOnce();
  expect(failure.detector.diagnostics().fallback).toBe("worker-initialization");
  failure.detector.close();
});

it("does not initialize fallback after cancellation", async () => {
  const test = setup();
  let reject!: (error: Error) => void;
  vi.mocked(test.worker.initialize).mockImplementation(() => new Promise((_done, fail) => { reject = fail; }));
  const pending = test.detector.initialize();
  test.detector.close();
  reject(new Error("cancelled"));
  await expect(pending).rejects.toThrow("cancelled");
  expect(test.options.createMain).not.toHaveBeenCalled();
});

it("fails closed on integrity errors instead of trying an unverified fallback", async () => {
  const test = setup();
  vi.mocked(test.worker.initialize).mockRejectedValue(new LandmarkDetectorError("model-integrity"));
  await expect(test.detector.initialize()).rejects.toMatchObject({ code: "model-integrity" });
  expect(test.options.createMain).not.toHaveBeenCalled();
  expect(test.worker.close).toHaveBeenCalledOnce();
});

it("stops on runtime failure instead of changing detector mid-sequence", async () => {
  const test = setup();
  vi.mocked(test.worker.detect).mockRejectedValue(new Error("context lost"));
  await test.detector.initialize();
  await expect(test.detector.detect(document.createElement("video"), 1)).rejects.toThrow("context lost");
  expect(test.options.createMain).not.toHaveBeenCalled();
  test.detector.close();
});
