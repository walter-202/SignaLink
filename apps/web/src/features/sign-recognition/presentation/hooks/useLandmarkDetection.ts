"use client";

import { useEffect, useState } from "react";
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
      return "Este navegador no puede cargar los landmarks locales. Puedes continuar con la captura de demostración.";
    case "model-load":
      return "No se pudieron cargar los landmarks. Revisa la conexión o continúa con la captura de demostración.";
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
}: UseLandmarkDetectionOptions): UseLandmarkDetectionReturn {
  const createDetector = useLandmarkDetectorFactory();
  const [status, setStatus] = useState<LandmarkDetectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<LandmarkFrame | null>(null);
  const [features, setFeatures] = useState<Float32Array | null>(null);

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
    let lastDetectionAt = 0;
    let lastTimestampMs = 0;
    let lastVideoTime = -1;
    const sourceVideo = video;
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
      animationFrame = window.requestAnimationFrame(run);
    }

    function run(now: number): void {
      if (cancelled || stopped) return;
      animationFrame = window.requestAnimationFrame(run);

      if (document.hidden) return;
      if (now - lastDetectionAt < frameIntervalMs) return;
      if (sourceVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (sourceVideo.videoWidth === 0 || sourceVideo.currentTime === lastVideoTime) return;

      lastDetectionAt = now;
      lastVideoTime = sourceVideo.currentTime;
      const timestampMs = Math.max(lastTimestampMs + 1, Math.round(performance.now()));
      lastTimestampMs = timestampMs;

      try {
        const frame = detector.detect(sourceVideo, timestampMs);
        if (cancelled) return;
        setLandmarks(frame);
        setFeatures(extractLsbFeatures(frame));
      } catch (cause) {
        if (cancelled) return;
        stopped = true;
        window.cancelAnimationFrame(animationFrame);
        const code = cause instanceof LandmarkDetectorError ? cause.code : "inference";
        setStatus("error");
        setError(getLandmarkErrorMessage(code));
      }
    }

    void detector.initialize()
      .then(() => {
        if (cancelled) return;
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
      window.cancelAnimationFrame(animationFrame);
      detector.close();
    };
  }, [createDetector, enabled, frameIntervalMs, video]);

  return { status, error, landmarks, features };
}
