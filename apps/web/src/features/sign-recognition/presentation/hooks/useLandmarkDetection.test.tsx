import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import type { LandmarkDetector } from "../../application/ports/landmark-detector";
import type { LandmarkFrame } from "../../domain/landmarks";
import { RecognitionPerformance } from "../../application/recognition-performance";
import { SignRecognitionContext } from "../SignRecognitionContext";
import { useLandmarkDetection } from "./useLandmarkDetection";

it("delivers every processed frame while throttling previews, and cancels on cleanup", async () => {
  const video = document.createElement("video");
  Object.defineProperties(video, {
    readyState: { value: 4 },
    videoWidth: { value: 640 },
    currentTime: { value: 0, writable: true },
  });
  let scheduled: VideoFrameRequestCallback;
  video.requestVideoFrameCallback = vi.fn((callback) => { scheduled = callback; return 1; });
  video.cancelVideoFrameCallback = vi.fn();
  const detector: LandmarkDetector = {
    initialize: vi.fn(async () => undefined),
    close: vi.fn(),
    isReady: () => true,
    detect: vi.fn((_video, timestampMs) => ({ pose: null, leftHand: null, rightHand: null, timestampMs })),
  };
  const factory = () => detector;
  const metrics = new RecognitionPerformance();
  const firstCallback = vi.fn();
  const extractFeatures = vi.fn(() => new Float32Array([9, 8, 7]));
  const secondCallback = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => <SignRecognitionContext.Provider value={factory}>{children}</SignRecognitionContext.Provider>;
  const { result, rerender, unmount } = renderHook(({ onFrame }) => useLandmarkDetection({
    video, enabled: true, frameIntervalMs: 33, previewIntervalMs: 100, onFrame, metrics, extractFeatures,
  }), { wrapper, initialProps: { onFrame: firstCallback } });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  function tick(now: number) {
    act(() => {
      video.currentTime = now / 1_000;
      scheduled(now, {} as VideoFrameCallbackMetadata);
    });
  }
  tick(0);
  const firstPreview = result.current.landmarks;
  tick(34);
  tick(68);
  expect(firstCallback).toHaveBeenCalledTimes(3);
  expect(firstCallback.mock.calls[2]?.[1]).toEqual(new Float32Array([9, 8, 7]));
  expect(extractFeatures).toHaveBeenCalledTimes(3);
  expect(result.current.landmarks).toBe(firstPreview);
  rerender({ onFrame: secondCallback });
  tick(102);
  expect(secondCallback).toHaveBeenCalledOnce();
  expect(result.current.landmarks).not.toBe(firstPreview);
  expect(detector.initialize).toHaveBeenCalledOnce();
  expect(metrics.snapshot().counters.frames).toBe(4);
  // An unchanged video frame must not be sent twice.
  act(() => scheduled(140, {} as VideoFrameCallbackMetadata));
  expect(detector.detect).toHaveBeenCalledTimes(4);
  unmount();
  expect(detector.close).toHaveBeenCalledOnce();
  expect(video.cancelVideoFrameCallback).toHaveBeenCalled();
  tick(180);
  expect(detector.detect).toHaveBeenCalledTimes(4);
});

it("keeps one async detection in flight, skips stale results and ignores a result after unmount", async () => {
  const video = document.createElement("video");
  Object.defineProperties(video, { readyState: { value: 4 }, videoWidth: { value: 640 }, currentTime: { value: 0, writable: true } });
  let scheduled!: VideoFrameRequestCallback;
  video.requestVideoFrameCallback = vi.fn((callback) => { scheduled = callback; return 1; });
  video.cancelVideoFrameCallback = vi.fn();
  let finish!: (frame: LandmarkFrame) => void;
  const detector: LandmarkDetector = {
    initialize: vi.fn(async () => undefined), close: vi.fn(), isReady: () => true,
    detect: vi.fn(() => new Promise<LandmarkFrame>((resolve) => { finish = resolve; })),
    diagnostics: () => ({ mode: "worker", delegate: "GPU", workerMs: 10, framePreparationMs: 2 }),
  };
  const factory = () => detector;
  const wrapper = ({ children }: { children: ReactNode }) => <SignRecognitionContext.Provider value={factory}>{children}</SignRecognitionContext.Provider>;
  const onFrame = vi.fn();
  const metrics = new RecognitionPerformance();
  const extractFeatures = () => new Float32Array(138);
  const { result, unmount } = renderHook(() => useLandmarkDetection({ video, enabled: true, metrics, extractFeatures, onFrame }), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  const tick = (now: number) => act(() => { video.currentTime = now / 1_000; scheduled(now, {} as VideoFrameCallbackMetadata); });
  tick(0); tick(70); tick(140);
  expect(detector.detect).toHaveBeenCalledOnce();
  expect(metrics.snapshot().counters.landmarkBusy).toBe(2);
  await act(async () => { finish({ timestampMs: 1, pose: null, leftHand: null, rightHand: null }); });
  expect(onFrame).toHaveBeenCalledOnce();
  expect(metrics.snapshot().landmarkRuntime).toMatchObject({ mode: "worker", delegate: "GPU" });
  expect(metrics.snapshot().timings.landmarkWorkerMs?.p50).toBe(10);
  tick(210);
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  await act(async () => { finish({ timestampMs: 2, pose: null, leftHand: null, rightHand: null }); });
  expect(onFrame).toHaveBeenCalledOnce();
  expect(metrics.snapshot().counters.landmarkStale).toBe(1);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  tick(280);
  unmount();
  await act(async () => { finish({ timestampMs: 3, pose: null, leftHand: null, rightHand: null }); });
  expect(onFrame).toHaveBeenCalledOnce();
  expect(metrics.snapshot().counters.frames).toBe(1);
});
