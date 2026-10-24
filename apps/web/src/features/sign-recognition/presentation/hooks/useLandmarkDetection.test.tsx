import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import type { LandmarkDetector } from "../../application/ports/landmark-detector";
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
