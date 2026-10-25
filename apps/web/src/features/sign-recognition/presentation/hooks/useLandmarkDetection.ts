"use client";

import { useEffect, useRef, useState } from "react";
import type { RecognitionPerformance } from "../../application/recognition-performance";
import {
  LandmarkDetectorError,
  type LandmarkDetectorErrorCode,
} from "../../application/ports/landmark-detector";
import {
  type LandmarkFrame,
  type SignFeatureExtractor,
} from "../../domain/landmarks";
import { useLandmarkDetectorFactory } from "../SignRecognitionContext";

export type LandmarkDetectionStatus = "idle" | "loading" | "ready" | "error";

export interface UseLandmarkDetectionOptions {
  video: HTMLVideoElement | null;
  enabled: boolean;
  frameIntervalMs?: number;
  previewIntervalMs?: number;
  onFrame?: (frame: LandmarkFrame, features: Float32Array) => void;
  metrics?: RecognitionPerformance;
  extractFeatures: SignFeatureExtractor;
}

export interface UseLandmarkDetectionReturn {
  status: LandmarkDetectionStatus;
  error: string | null;
  landmarks: LandmarkFrame | null;
  features: Float32Array | null;
}

function getLandmarkErrorMessage(code: LandmarkDetectorErrorCode): string {
  switch (code) {
    case "not-supported":
      return "Este navegador no puede cargar los landmarks locales. Puedes escribir la respuesta.";
    case "model-load":
      return "No se pudieron cargar los landmarks. Revisa la conexión o escribe la respuesta.";
    case "model-integrity":
      return "El archivo de landmarks no coincide con el modelo configurado. Revisa su versión antes de activar la captura. Puedes escribir la respuesta.";
    case "inference":
      return "La detección de landmarks se detuvo. Detén la cámara y vuelve a intentarlo.";
    case "closed":
      return "La detección de landmarks se cerró.";
  }
}

export function useLandmarkDetection({
  video,
  enabled,
  frameIntervalMs = 66,
  previewIntervalMs = 100,
  onFrame,
  metrics,
  extractFeatures,
}: UseLandmarkDetectionOptions): UseLandmarkDetectionReturn {
  const createDetector = useLandmarkDetectorFactory();
  const [status, setStatus] = useState<LandmarkDetectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<LandmarkFrame | null>(null);
  const [features, setFeatures] = useState<Float32Array | null>(null);
  const onFrameRef = useRef(onFrame);
  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !video) {
      queueMicrotask(() => {
        if (cancelled) return;
        setStatus("idle");
        setError(null);
        setLandmarks(null);
        setFeatures(null);
      });
      return () => {
        cancelled = true;
      };
    }

    let stopped = false;
    let animationFrame = 0;
    let lastDetectionAt = Number.NEGATIVE_INFINITY;
    let lastPreviewAt = Number.NEGATIVE_INFINITY;
    let previousFrameAt: number | null = null;
    let lastTimestampMs = 0;
    let lastVideoTime = -1;
    let detecting = false;
    const sourceVideo = video;
    const useVideoFrames = typeof sourceVideo.requestVideoFrameCallback === "function"
      && typeof sourceVideo.cancelVideoFrameCallback === "function";
    const detector = createDetector();

    queueMicrotask(() => {
      if (cancelled) return;
      setStatus("loading");
      setError(null);
      setLandmarks(null);
      setFeatures(null);
    });

    function schedule() {
      if (cancelled || stopped) return;
      animationFrame = useVideoFrames
        ? sourceVideo.requestVideoFrameCallback(run)
        : window.requestAnimationFrame(run);
    }

    function cancelScheduledFrame() {
      if (useVideoFrames) {
        sourceVideo.cancelVideoFrameCallback(animationFrame);
      } else {
        window.cancelAnimationFrame(animationFrame);
      }
    }

    function run(now: number): void {
      if (cancelled || stopped) return;
      schedule();

      if (document.hidden) return;
      if (now - lastDetectionAt < frameIntervalMs) return;
      if (sourceVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (sourceVideo.videoWidth === 0 || sourceVideo.currentTime === lastVideoTime) return;
      if (detecting) {
        metrics?.increment("landmarkBusy");
        return;
      }

      lastDetectionAt = now;
      lastVideoTime = sourceVideo.currentTime;
      const timestampMs = Math.max(lastTimestampMs + 1, Math.round(performance.now()));
      lastTimestampMs = timestampMs;

      const detectionStartedAt = performance.now();
      detecting = true;

      function fail(cause: unknown) {
        detecting = false;
        if (cancelled) return;
        stopped = true;
        cancelScheduledFrame();
        detector.close();
        const code = cause instanceof LandmarkDetectorError ? cause.code : "inference";
        setStatus("error");
        setError(getLandmarkErrorMessage(code));
      }

      function complete(frame: LandmarkFrame) {
        detecting = false;
        if (cancelled || stopped) return;
        const detectedAt = performance.now();
        if (document.hidden || detectedAt - detectionStartedAt > 1_000) {
          metrics?.increment("landmarkStale");
          return;
        }
        const nextFeatures = extractFeatures(frame);
        metrics?.record("landmarkMs", detectedAt - detectionStartedAt);
        metrics?.record("featuresMs", performance.now() - detectedAt);
        const info = detector.diagnostics?.();
        if (info) {
          metrics?.setLandmarkRuntime(info);
          if (info.workerMs !== undefined) metrics?.record("landmarkWorkerMs", info.workerMs);
          if (info.framePreparationMs !== undefined) metrics?.record("framePreparationMs", info.framePreparationMs);
        }
        metrics?.increment("frames");
        if (previousFrameAt !== null && detectionStartedAt - previousFrameAt < 1_000) {
          metrics?.record("frameIntervalMs", detectionStartedAt - previousFrameAt);
        }
        previousFrameAt = detectionStartedAt;
        // Acquisition is independent of React rendering and overlay refresh frequency.
        onFrameRef.current?.(frame, nextFeatures);
        if (now - lastPreviewAt >= previewIntervalMs) {
          lastPreviewAt = now;
          setLandmarks(frame);
          setFeatures(nextFeatures);
        }
      }

      try {
        const result = detector.detect(sourceVideo, timestampMs);
        if (result instanceof Promise) void result.then(complete).catch(fail);
        else complete(result);
      } catch (cause) {
        fail(cause);
      }
    }

    const loadingStartedAt = performance.now();
    void detector.initialize()
      .then(() => {
        if (cancelled) return;
        metrics?.record("landmarkLoadMs", performance.now() - loadingStartedAt);
        const info = detector.diagnostics?.();
        if (info) {
          metrics?.setLandmarkRuntime(info);
          if (info.asset) {
            metrics?.record("landmarkAssetReadMs", info.asset.readMs);
            metrics?.record("landmarkAssetIntegrityMs", info.asset.integrityMs);
          }
        }
        setStatus("ready");
        schedule();
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const code = cause instanceof LandmarkDetectorError ? cause.code : "model-load";
        setStatus("error");
        setError(getLandmarkErrorMessage(code));
      });

    return () => {
      cancelled = true;
      stopped = true;
      cancelScheduledFrame();
      detector.close();
    };
  }, [createDetector, enabled, frameIntervalMs, previewIntervalMs, metrics, extractFeatures, video]);

  return { status, error, landmarks, features };
}
