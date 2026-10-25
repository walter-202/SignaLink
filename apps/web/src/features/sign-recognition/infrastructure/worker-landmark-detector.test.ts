import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkerLandmarkDetector } from "./worker-landmark-detector";
import type { HolisticWorkerResponse } from "./holistic-worker-protocol";

vi.mock("./holistic-model-asset", () => ({
  configuredHolisticModelAsset: () => ({ url: "/synthetic.task", pin: null }),
  loadHolisticModelAsset: vi.fn(async () => ({ buffer: new ArrayBuffer(3), diagnostics: { integrity: "unverified", source: "fetch", bytes: 3, readMs: 1, integrityMs: 0 } })),
}));

class FakeWorker {
  static instance: FakeWorker;
  onmessage: ((event: MessageEvent<HolisticWorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { FakeWorker.instance = this; }
  emit(data: HolisticWorkerResponse) { this.onmessage?.({ data } as MessageEvent<HolisticWorkerResponse>); }
}

beforeEach(() => { vi.stubGlobal("Worker", FakeWorker); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function ready() {
  const detector = new WorkerLandmarkDetector();
  const initialization = detector.initialize();
  expect(detector.initialize()).toBe(initialization);
  await Promise.resolve();
  FakeWorker.instance.emit({ type: "ready", delegate: "CPU" });
  await initialization;
  return detector;
}

it("transfers one bitmap, refuses concurrent frames, ignores obsolete IDs and maps the unchanged landmarks", async () => {
  const detector = await ready();
  const bitmap = { close: vi.fn() };
  vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
  const result = detector.detect(document.createElement("video"), 42);
  await Promise.resolve();
  await expect(detector.detect(document.createElement("video"), 43)).rejects.toMatchObject({ code: "inference" });
  expect(FakeWorker.instance.postMessage.mock.calls[1]?.[1]).toEqual([bitmap]);
  FakeWorker.instance.emit({ type: "result", id: 99, timestampMs: 42, result: {}, workerMs: 12 });
  const point = { x: 0.1, y: 0.2, z: 0.3, visibility: 0.9 };
  FakeWorker.instance.emit({ type: "result", id: 1, timestampMs: 42, result: { poseLandmarks: [[point]] }, workerMs: 12 });
  await expect(result).resolves.toEqual({ timestampMs: 42, pose: [point], leftHand: null, rightHand: null });
  expect(bitmap.close).not.toHaveBeenCalled(); // Ownership belongs to the worker.
  expect(detector.diagnostics()).toMatchObject({ mode: "worker", delegate: "CPU", workerMs: 12 });
  detector.close();
});

it("closes an untransferred image if capture ends while bitmap creation is pending", async () => {
  const detector = await ready();
  let resolve!: (bitmap: ImageBitmap) => void;
  vi.stubGlobal("createImageBitmap", vi.fn(() => new Promise<ImageBitmap>((done) => { resolve = done; })));
  const pending = detector.detect(document.createElement("video"), 1);
  detector.close();
  const bitmap = { close: vi.fn() };
  resolve(bitmap as unknown as ImageBitmap);
  await expect(pending).rejects.toMatchObject({ code: "closed" });
  expect(bitmap.close).toHaveBeenCalledOnce();
  expect(FakeWorker.instance.postMessage).toHaveBeenCalledOnce(); // Initialization only.
  expect(FakeWorker.instance.terminate).toHaveBeenCalledOnce();
});

it("rejects an in-flight frame on close without accepting a late result", async () => {
  const detector = await ready();
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
  const pending = detector.detect(document.createElement("video"), 1);
  await Promise.resolve();
  detector.close();
  FakeWorker.instance.emit({ type: "result", id: 1, timestampMs: 1, result: {}, workerMs: 1 });
  await expect(pending).rejects.toMatchObject({ code: "closed" });
  expect(detector.isReady()).toBe(false);
});

it("terminates an unresponsive initializer and rejects on worker errors", async () => {
  vi.useFakeTimers();
  const detector = new WorkerLandmarkDetector();
  const pending = expect(detector.initialize()).rejects.toMatchObject({ code: "model-load" });
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(60_000);
  await pending;
  expect(FakeWorker.instance.terminate).toHaveBeenCalledOnce();
});

it("bounds an unresponsive detection and frees the worker on failure", async () => {
  vi.useFakeTimers();
  const detector = await ready();
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
  const pending = expect(detector.detect(document.createElement("video"), 1)).rejects.toMatchObject({ code: "inference" });
  await vi.advanceTimersByTimeAsync(10_000);
  await pending;
  expect(FakeWorker.instance.terminate).toHaveBeenCalledOnce();
});
