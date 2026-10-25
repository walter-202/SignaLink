import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapHolisticResult, MediaPipeHolisticLandmarkDetector } from "./mediapipe-holistic-landmark-detector";
import { defineHolisticModelAsset } from "./holistic-model-asset";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: async () => ({ wasmLoaderPath: "/local.js", wasmBinaryPath: "/local.wasm" }) },
  HolisticLandmarker: { createFromOptions: mocks.create },
}));
const modelBytes = new Uint8Array([1, 2, 3, 4]);
const asset = defineHolisticModelAsset({ url: "/synthetic.task", version: "fixture-v1", sha256: createHash("sha256").update(modelBytes).digest("hex"), bytes: 4 });
beforeEach(() => {
  mocks.create.mockReset();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("caches", undefined);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(modelBytes)));
});
afterEach(() => { vi.unstubAllGlobals(); });

const landmark = (x: number, y: number, z: number, visibility: number) => ({
  x,
  y,
  z,
  visibility,
});

it("loads and verifies once, then reuses the same model bytes for GPU/CPU fallback", async () => {
  const engine = { close: vi.fn() };
  mocks.create.mockRejectedValueOnce(new Error("GPU unavailable")).mockResolvedValueOnce(engine);
  const detector = new MediaPipeHolisticLandmarkDetector({ modelAsset: asset });
  await Promise.all([detector.initialize(), detector.initialize()]);
  expect(fetch).toHaveBeenCalledOnce();
  expect(mocks.create).toHaveBeenCalledTimes(2);
  const gpu = mocks.create.mock.calls[0]![1].baseOptions;
  const cpu = mocks.create.mock.calls[1]![1].baseOptions;
  expect(gpu.modelAssetBuffer).toEqual(modelBytes);
  expect(cpu.modelAssetBuffer.buffer).toBe(gpu.modelAssetBuffer.buffer);
  expect(gpu).not.toHaveProperty("modelAssetPath");
  expect(detector.diagnostics()).toMatchObject({ delegate: "CPU", asset: { integrity: "verified" } });
  detector.close();
  expect(engine.close).toHaveBeenCalledOnce();
});

it("never creates a MediaPipe session from bytes with an invalid hash", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array([4, 3, 2, 1])));
  const detector = new MediaPipeHolisticLandmarkDetector({ modelAsset: asset });
  await expect(detector.initialize()).rejects.toMatchObject({ code: "model-integrity" });
  expect(mocks.create).not.toHaveBeenCalled();
  expect(detector.isReady()).toBe(false);
  detector.close();
});

it("aborts a pending download when closed without creating a late detector", async () => {
  let requestSignal!: AbortSignal;
  vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    requestSignal = options!.signal!;
    requestSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  const detector = new MediaPipeHolisticLandmarkDetector({ modelAsset: asset });
  const pending = detector.initialize();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  detector.close();
  await expect(pending).rejects.toMatchObject({ code: "closed" });
  expect(requestSignal.aborted).toBe(true);
  expect(mocks.create).not.toHaveBeenCalled();
});

describe("mapHolisticResult", () => {
  it("maps only the first detected pose and hands to plain landmarks", () => {
    const result = mapHolisticResult({
      poseLandmarks: [[landmark(0.5, 0.2, -0.1, 0.99)]],
      leftHandLandmarks: [],
      rightHandLandmarks: [[landmark(0.2, 0.3, 0.01, 0.8)]],
    }, 1234);

    expect(result).toEqual({
      pose: [{ x: 0.5, y: 0.2, z: -0.1, visibility: 0.99 }],
      leftHand: null,
      rightHand: [{ x: 0.2, y: 0.3, z: 0.01, visibility: 0.8 }],
      timestampMs: 1234,
    });
  });

  it("returns nulls when the model does not detect a person", () => {
    const result = mapHolisticResult({
      poseLandmarks: [],
      leftHandLandmarks: undefined,
      rightHandLandmarks: [],
    }, 42);

    expect(result).toEqual({
      pose: null,
      leftHand: null,
      rightHand: null,
      timestampMs: 42,
    });
  });
});
