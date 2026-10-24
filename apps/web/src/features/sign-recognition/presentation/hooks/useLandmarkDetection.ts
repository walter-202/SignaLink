"use client";

import { useEffect, useRef, useState } from "react";
import type { RecognitionPerformance } from "../../application/recognition-performance";
import {
  LandmarkDetectorError,
  type LandmarkDetectorErrorCode,
} from "../../application/ports/landmark-detector";
import {
  extractLsbFeatures,
  type LandmarkFrame,
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

      lastDetectionAt = now;
      lastVideoTime = sourceVideo.currentTime;
      const timestampMs = Math.max(lastTimestampMs + 1, Math.round(performance.now()));
      lastTimestampMs = timestampMs;

      try {
        const detectionStartedAt = performance.now();
        const frame = detector.detect(sourceVideo, timestampMs);
        if (cancelled) return;
        const detectedAt = performance.now();
        const nextFeatures = extractLsbFeatures(frame);
        metrics?.record("landmarkMs", detectedAt - detectionStartedAt);
        metrics?.record("featuresMs", performance.now() - detectedAt);
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
      } catch (cause) {
        if (cancelled) return;
        stopped = true;
        cancelScheduledFrame();
        const code = cause instanceof LandmarkDetectorError ? cause.code : "inference";
        setStatus("error");
        setError(getLandmarkErrorMessage(code));
      }
    }

    const loadingStartedAt = performance.now();
    void detector.initialize()
      .then(() => {
        if (cancelled) return;
        metrics?.record("landmarkLoadMs", performance.now() - loadingStartedAt);
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
  }, [createDetector, enabled, frameIntervalMs, previewIntervalMs, metrics, video]);

  return { status, error, landmarks, features };
}
