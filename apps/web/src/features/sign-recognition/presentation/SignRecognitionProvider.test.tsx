import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import type { LandmarkDetector } from "../application/ports/landmark-detector";
import { extractLsbFeatures } from "../domain/landmarks";
import { useLandmarkRuntime } from "./SignRecognitionContext";
import { useLandmarkDetection } from "./hooks/useLandmarkDetection";
import { SignRecognitionProvider } from "./SignRecognitionProvider";

const created = vi.hoisted(() => [] as Array<{ worker: boolean; detector: LandmarkDetector; finish: () => void }>);
vi.mock("../infrastructure/browser-landmark-detector", () => ({
  BrowserLandmarkDetector: class {
    constructor(options: { preferWorker: boolean }) {
      let finish!: () => void;
      const ready = new Promise<void>((resolve) => { finish = resolve; });
      const detector: LandmarkDetector = { initialize: vi.fn(() => ready), close: vi.fn(), isReady: () => true, detect: vi.fn() };
      created.push({ worker: options.preferWorker, detector, finish });
      return detector;
    }
  },
}));

it("replaces and closes a loading detector on engine change without publishing its late initialization", async () => {
  created.length = 0;
  const video = document.createElement("video");
  video.requestVideoFrameCallback = vi.fn(() => 1); video.cancelVideoFrameCallback = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => <SignRecognitionProvider>{children}</SignRecognitionProvider>;
  const { result, unmount } = renderHook(() => ({
    engine: useLandmarkRuntime(),
    detection: useLandmarkDetection({ video, enabled: true, extractFeatures: extractLsbFeatures }),
  }), { wrapper });
  await waitFor(() => expect(result.current.detection.status).toBe("loading"));
  expect(created).toHaveLength(1);
  act(() => result.current.engine.selectMode("worker"));
  expect(created).toHaveLength(2);
  expect(created[0]!.detector.close).toHaveBeenCalledOnce();
  expect(created[1]!.worker).toBe(true);
  await act(async () => created[0]!.finish());
  expect(result.current.detection.status).toBe("loading");
  await act(async () => created[1]!.finish());
  expect(result.current.detection.status).toBe("ready");
  expect(video.requestVideoFrameCallback).toHaveBeenCalledOnce();
  unmount();
  expect(created[1]!.detector.close).toHaveBeenCalledOnce();
});

it("leaves injected detector selection under the caller's control", () => {
  const factory = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => <SignRecognitionProvider createDetector={factory}>{children}</SignRecognitionProvider>;
  const { result } = renderHook(useLandmarkRuntime, { wrapper });
  expect(result.current.selectable).toBe(false);
  expect(() => result.current.selectMode("worker")).toThrow("detector inyectado");
  expect(factory).not.toHaveBeenCalled();
});
