import { LandmarkDetectorError, type LandmarkDetector, type LandmarkDetectorDiagnostics } from "../application/ports/landmark-detector";
import { MediaPipeHolisticLandmarkDetector } from "./mediapipe-holistic-landmark-detector";
import { WorkerLandmarkDetector } from "./worker-landmark-detector";

interface BrowserLandmarkOptions {
  preferWorker: boolean;
  workerSupported: () => boolean;
  createWorker: () => LandmarkDetector;
  createMain: () => LandmarkDetector;
}

/** Opt-in until representative browser/device comparisons justify promotion. */
export class BrowserLandmarkDetector implements LandmarkDetector {
  private detector: LandmarkDetector | null = null;
  private closed = false;
  private initializing: Promise<void> | null = null;
  private fallback: LandmarkDetectorDiagnostics["fallback"];
  private readonly options: BrowserLandmarkOptions;

  constructor(options: Partial<BrowserLandmarkOptions> = {}) {
    this.options = {
      preferWorker: process.env.NEXT_PUBLIC_MEDIAPIPE_WORKER === "on",
      workerSupported: () => WorkerLandmarkDetector.supported(),
      createWorker: () => new WorkerLandmarkDetector(),
      createMain: () => new MediaPipeHolisticLandmarkDetector(),
      ...options,
    };
  }

  isReady = () => !this.closed && (this.detector?.isReady() ?? false);
  diagnostics = (): LandmarkDetectorDiagnostics => ({ ...(this.detector?.diagnostics?.() ?? { mode: "main-thread" }), fallback: this.fallback });

  initialize = (): Promise<void> => {
    if (this.closed) return Promise.reject(new LandmarkDetectorError("closed"));
    if (this.isReady()) return Promise.resolve();
    if (!this.initializing) this.initializing = this.load();
    return this.initializing;
  };

  private async load(): Promise<void> {
    if (this.options.preferWorker && this.options.workerSupported()) {
      this.detector = this.options.createWorker();
      try {
        await this.detector.initialize();
        if (this.closed) throw new LandmarkDetectorError("closed");
        return;
      } catch (cause) {
        this.detector.close();
        if (this.closed) throw cause;
        if (cause instanceof LandmarkDetectorError && cause.code === "model-integrity") throw cause;
        this.fallback = "worker-initialization";
      }
    } else if (this.options.preferWorker) {
      this.fallback = "unsupported";
    }
    if (this.closed) throw new LandmarkDetectorError("closed");
    this.detector = this.options.createMain();
    await this.detector.initialize();
    if (this.closed) throw new LandmarkDetectorError("closed");
  }

  detect = (video: HTMLVideoElement, timestampMs: number) => {
    if (this.closed) throw new LandmarkDetectorError("closed");
    if (!this.detector) throw new LandmarkDetectorError("inference");
    // Runtime failures stop capture. Never silently switch mid-sequence.
    return this.detector.detect(video, timestampMs);
  };

  close = (): void => { this.closed = true; this.detector?.close(); };
}
