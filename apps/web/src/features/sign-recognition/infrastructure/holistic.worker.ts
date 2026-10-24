// Classic worker: MediaPipe's WASM loader uses importScripts. This file is
// transpiled by copy-mediapipe-wasm.mjs, with no runtime imports or bundler shim.
(() => {
  type Request = import("./holistic-worker-protocol").HolisticWorkerRequest;
  type Response = import("./holistic-worker-protocol").HolisticWorkerResponse;
  type Vision = typeof import("@mediapipe/tasks-vision");
  const scope = globalThis as unknown as {
    location: { href: string };
    importScripts: (...urls: string[]) => void;
    postMessage: (message: Response) => void;
    onmessage: (event: MessageEvent<Request>) => void;
    Vision: Vision;
  };
  let detector: import("@mediapipe/tasks-vision").HolisticLandmarker | null = null;
  let initializing = false;

  scope.onmessage = async ({ data }) => {
    if (data.type === "initialize") {
      if (initializing || detector) return;
      initializing = true;
      try {
        scope.importScripts(new URL("./vision_bundle.js", scope.location.href).href);
        const files = await scope.Vision.FilesetResolver.forVisionTasks(data.wasmPath);
        let delegate: "GPU" | "CPU" = "GPU";
        const create = (delegate: "GPU" | "CPU") => scope.Vision.HolisticLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: data.modelUrl, delegate },
          runningMode: "VIDEO",
          minFaceDetectionConfidence: 0.5,
          minPoseDetectionConfidence: 0.5,
          minHandLandmarksConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputPoseSegmentationMasks: false,
        });
        try { detector = await create(delegate); }
        catch { delegate = "CPU"; detector = await create(delegate); }
        scope.postMessage({ type: "ready", delegate });
      } catch {
        scope.postMessage({ type: "error", code: "model-load" });
      }
      return;
    }

    const { bitmap, id, timestampMs } = data;
    try {
      if (!detector) throw new Error("Detector not initialized");
      const startedAt = performance.now();
      const result = detector.detectForVideo(bitmap, timestampMs);
      // Do not send face landmarks, segmentation masks or the image back.
      scope.postMessage({ type: "result", id, timestampMs, workerMs: performance.now() - startedAt,
        result: { poseLandmarks: result.poseLandmarks, leftHandLandmarks: result.leftHandLandmarks, rightHandLandmarks: result.rightHandLandmarks } });
    } catch {
      scope.postMessage({ type: "error", id, code: "inference" });
    } finally {
      bitmap.close();
    }
  };
})();
