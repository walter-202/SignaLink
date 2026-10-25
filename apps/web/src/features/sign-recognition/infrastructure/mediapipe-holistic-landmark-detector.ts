import type {
  HolisticLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  LandmarkDetectorError,
  type LandmarkDetector,
} from "../application/ports/landmark-detector";
import type { LandmarkFrame, LandmarkPoint } from "../domain/landmarks";
import type { HolisticModelAsset, HolisticAssetDiagnostics } from "../domain/holistic-model-asset";
import { configuredHolisticModelAsset, loadHolisticModelAsset } from "./holistic-model-asset";

const configuredWasmPath = process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_PATH?.trim();
export const DEFAULT_WASM_PATH = configuredWasmPath || "/mediapipe/wasm";

export interface HolisticResultLike {
  poseLandmarks?: NormalizedLandmark[][];
  leftHandLandmarks?: NormalizedLandmark[][];
  rightHandLandmarks?: NormalizedLandmark[][];
}

function toLandmarkPoints(
  landmarks: NormalizedLandmark[] | undefined,
): LandmarkPoint[] | null {
  if (!landmarks || landmarks.length === 0) return null;

  return landmarks.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    visibility: point.visibility,
  }));
}

export function mapHolisticResult(
  result: HolisticResultLike,
  timestampMs: number,
): LandmarkFrame {
  return {
    pose: toLandmarkPoints(result.poseLandmarks?.[0]),
    leftHand: toLandmarkPoints(result.leftHandLandmarks?.[0]),
    rightHand: toLandmarkPoints(result.rightHandLandmarks?.[0]),
    timestampMs,
  };
}

interface VisionFileset {
  wasmLoaderPath: string;
  wasmBinaryPath: string;
  assetLoaderPath?: string;
  assetBinaryPath?: string;
}

export interface MediaPipeHolisticOptions {
  wasmPath?: string;
  modelUrl?: string;
  modelAsset?: HolisticModelAsset;
  delegate?: "GPU" | "CPU";
}

export class MediaPipeHolisticLandmarkDetector implements LandmarkDetector {
  private landmarker: HolisticLandmarker | null = null;
  private initializing: Promise<void> | null = null;
  private closed = false;
  private readonly wasmPath: string;
  private readonly options: MediaPipeHolisticOptions;
  private downloadController = new AbortController();
  private assetInfo: HolisticAssetDiagnostics | undefined;
  private readonly preferredDelegate: "GPU" | "CPU";
  private activeDelegate: "GPU" | "CPU" | undefined;

  constructor(options: MediaPipeHolisticOptions = {}) {
    this.wasmPath = options.wasmPath ?? DEFAULT_WASM_PATH;
    this.options = options;
    this.preferredDelegate = options.delegate ?? "GPU";
  }

  isReady = (): boolean => this.landmarker !== null;

  initialize = async (): Promise<void> => {
    if (this.landmarker) return;
    if (this.closed) throw new LandmarkDetectorError("closed");
    if (this.initializing) return this.initializing;

    this.initializing = this.load().finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  };

  private async load(): Promise<void> {
    if (typeof document === "undefined") {
      throw new LandmarkDetectorError("not-supported");
    }

    try {
      const asset = this.options.modelAsset ?? configuredHolisticModelAsset(this.options.modelUrl);
      const loaded = await loadHolisticModelAsset(asset, this.downloadController.signal);
      if (this.closed) throw new LandmarkDetectorError("closed");
      this.assetInfo = loaded.diagnostics;
      const { FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(this.wasmPath);
      if (this.closed) throw new LandmarkDetectorError("closed");

      let landmarker: HolisticLandmarker;
      try {
        landmarker = await this.create(vision, this.preferredDelegate, loaded.buffer);
        this.activeDelegate = this.preferredDelegate;
      } catch (error) {
        if (this.preferredDelegate === "CPU") throw error;
        if (this.closed) throw new LandmarkDetectorError("closed");
        landmarker = await this.create(vision, "CPU", loaded.buffer);
        this.activeDelegate = "CPU";
      }

      if (this.closed) {
        landmarker.close();
        throw new LandmarkDetectorError("closed");
      }
      this.landmarker = landmarker;
    } catch (cause) {
      if (this.closed) throw new LandmarkDetectorError("closed");
      if (cause instanceof LandmarkDetectorError) throw cause;
      throw new LandmarkDetectorError("model-load", { cause });
    }
  }

  private async create(
    vision: VisionFileset,
    delegate: "GPU" | "CPU",
    buffer: ArrayBuffer,
  ): Promise<HolisticLandmarker> {
    const { HolisticLandmarker } = await import("@mediapipe/tasks-vision");
    return HolisticLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetBuffer: new Uint8Array(buffer),
        delegate,
      },
      runningMode: "VIDEO",
      minFaceDetectionConfidence: 0.5,
      minPoseDetectionConfidence: 0.5,
      minHandLandmarksConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputPoseSegmentationMasks: false,
    });
  }

  detect = (video: HTMLVideoElement, timestampMs: number): LandmarkFrame => {
    if (this.closed) throw new LandmarkDetectorError("closed");
    if (!this.landmarker) throw new LandmarkDetectorError("inference");

    try {
      const result = this.landmarker.detectForVideo(video, timestampMs);
      return mapHolisticResult(result, timestampMs);
    } catch (cause) {
      throw new LandmarkDetectorError("inference", { cause });
    }
  };

  close = (): void => {
    this.closed = true;
    this.downloadController.abort();
    this.landmarker?.close();
    this.landmarker = null;
  };

  diagnostics = () => ({ mode: "main-thread" as const, delegate: this.activeDelegate, asset: this.assetInfo });
}
