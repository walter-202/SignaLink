import type { LandmarkFrame } from "../../domain/landmarks";

export type LandmarkDetectorErrorCode =
  | "not-supported"
  | "model-load"
  | "model-integrity"
  | "inference"
  | "closed";

export class LandmarkDetectorError extends Error {
  readonly code: LandmarkDetectorErrorCode;

  constructor(code: LandmarkDetectorErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "LandmarkDetectorError";
    this.code = code;
  }
}

/** Port for on-device landmark extraction. */
export interface LandmarkDetector {
  initialize: () => Promise<void>;
  detect: (video: HTMLVideoElement, timestampMs: number) => LandmarkFrame | Promise<LandmarkFrame>;
  close: () => void;
  isReady: () => boolean;
  diagnostics?: () => LandmarkDetectorDiagnostics;
}

export interface LandmarkDetectorDiagnostics {
  mode: "main-thread" | "worker";
  delegate?: "GPU" | "CPU";
  fallback?: "unsupported" | "worker-initialization";
  workerMs?: number;
  framePreparationMs?: number;
  asset?: import("../../domain/holistic-model-asset").HolisticAssetDiagnostics;
}
