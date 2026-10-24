import { LandmarkDetectorError, type LandmarkDetector, type LandmarkDetectorDiagnostics } from "../application/ports/landmark-detector";
import type { LandmarkFrame } from "../domain/landmarks";
import { DEFAULT_MODEL_URL, DEFAULT_WASM_PATH, mapHolisticResult } from "./mediapipe-holistic-landmark-detector";
import type { HolisticWorkerRequest, HolisticWorkerResponse } from "./holistic-worker-protocol";

export const HOLISTIC_WORKER_URL = "/mediapipe/1.1.1/holistic-worker.js";

export class WorkerLandmarkDetector implements LandmarkDetector {
  private worker: Worker | null = null;
  private ready = false;
  private closed = false;
  private busy = false;
  private requestId = 0;
  private initializing: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private pending: { id: number; resolve: (frame: LandmarkFrame) => void; reject: (error: Error) => void } | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private info: LandmarkDetectorDiagnostics = { mode: "worker" };

  static supported(): boolean {
    return typeof Worker !== "undefined" && typeof createImageBitmap === "function" && typeof OffscreenCanvas !== "undefined";
  }

  isReady = () => this.ready && !this.closed;
  diagnostics = () => ({ ...this.info });

  initialize = (): Promise<void> => {
    if (this.closed) return Promise.reject(new LandmarkDetectorError("closed"));
    if (this.ready) return Promise.resolve();
    if (this.initializing) return this.initializing;
    this.initializing = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
      try {
        // A classic worker is required by the pinned MediaPipe WASM loader.
        this.worker = new Worker(HOLISTIC_WORKER_URL, { name: "signalink-holistic" });
        this.worker.onmessage = this.onMessage;
        this.worker.onerror = this.onError;
        this.worker.onmessageerror = this.onError;
        this.armTimeout(60_000, "model-load");
        this.post({ type: "initialize", wasmPath: new URL(DEFAULT_WASM_PATH, location.href).href, modelUrl: new URL(DEFAULT_MODEL_URL, location.href).href });
      } catch { this.fail("model-load"); }
    });
    return this.initializing;
  };

  private post(message: HolisticWorkerRequest, transfer: Transferable[] = []): void {
    this.worker!.postMessage(message, transfer);
  }

  detect = async (video: HTMLVideoElement, timestampMs: number): Promise<LandmarkFrame> => {
    if (this.closed) throw new LandmarkDetectorError("closed");
    if (!this.ready || this.busy) throw new LandmarkDetectorError("inference");
    this.busy = true; // Includes bitmap preparation; there is no frame queue.
    let bitmap: ImageBitmap | null = null;
    try {
      const startedAt = performance.now();
      bitmap = await createImageBitmap(video);
      this.info.framePreparationMs = performance.now() - startedAt;
      if (this.closed) throw new LandmarkDetectorError("closed");
      const id = ++this.requestId;
      return await new Promise<LandmarkFrame>((resolve, reject) => {
        this.pending = { id, resolve, reject };
        this.armTimeout(10_000, "inference");
        try {
          this.post({ type: "detect", id, bitmap: bitmap!, timestampMs }, [bitmap!]);
          bitmap = null; // Ownership transferred; the worker closes it.
        } catch { this.fail("inference"); }
      });
    } finally {
      bitmap?.close();
      this.busy = false;
    }
  };

  private onMessage = ({ data }: MessageEvent<HolisticWorkerResponse>): void => {
    if (this.closed) return;
    if (data.type === "ready") {
      if (this.ready) return;
      this.clearTimeout();
      this.ready = true;
      this.info.delegate = data.delegate;
      this.resolveReady?.();
      this.resolveReady = this.rejectReady = null;
    } else if (data.type === "result") {
      if (data.id !== this.pending?.id) return;
      this.clearTimeout();
      this.info.workerMs = data.workerMs;
      const pending = this.pending;
      this.pending = null;
      pending.resolve(mapHolisticResult(data.result, data.timestampMs));
    } else if (data.type === "error") {
      this.fail(data.code);
    }
  };

  private onError = (): void => { this.fail(this.ready ? "inference" : "model-load"); };

  private armTimeout(ms: number, code: "model-load" | "inference"): void {
    this.clearTimeout();
    this.timeout = setTimeout(() => this.fail(code), ms);
  }

  private clearTimeout(): void {
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.timeout = null;
  }

  private fail(code: "closed" | "model-load" | "inference"): void {
    const error = new LandmarkDetectorError(code);
    this.clearTimeout();
    this.rejectReady?.(error);
    this.pending?.reject(error);
    this.resolveReady = this.rejectReady = null;
    this.pending = null;
    this.ready = false;
    this.worker?.terminate();
    this.worker = null;
    this.closed = true;
  }

  close = (): void => { this.fail("closed"); };
}
