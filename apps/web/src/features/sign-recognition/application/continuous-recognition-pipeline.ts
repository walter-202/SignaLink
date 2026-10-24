import type { LandmarkFrame } from "../domain/landmarks";
import { ContinuousSignSegmenter } from "./continuous-sign-segmenter";
import type { SignClassification, SignClassifier } from "./ports/sign-classifier";
import type { RecognitionPerformance } from "./recognition-performance";

interface PipelineOptions {
  classifier: SignClassifier;
  performance: RecognitionPerformance;
  onPrediction: (prediction: SignClassification) => void;
  onProgress: (progress: number) => void;
  onProcessing: () => void;
  onError: (message: string, code: "missing-hands" | "overloaded" | "stale" | "inference" | "frame-gap") => void;
  now?: () => number;
}

interface Segment {
  sequence: Float32Array[];
  startedAt: number;
  endedAt: number;
  generation: number;
}

/** One inference in flight, one pending segment. Acquisition never waits for classification. */
export class ContinuousRecognitionPipeline {
  private segmenter = new ContinuousSignSegmenter();
  private active = false;
  private generation = 0;
  private busy = false;
  private pending: Segment | null = null;
  private lastFrameAt: number | null = null;
  private readonly now: () => number;

  constructor(private readonly options: PipelineOptions) {
    this.now = options.now ?? (() => performance.now());
  }

  start(): void {
    this.stop();
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.generation += 1;
    this.pending = null;
    this.lastFrameAt = null;
    this.segmenter.reset();
    // Keep the lock until the actual inference settles, including across stop/start.
  }

  push(landmarks: LandmarkFrame, features: Float32Array): void {
    if (!this.active) return;
    const now = this.now();
    if (this.lastFrameAt !== null && now - this.lastFrameAt > 1_000) {
      this.segmenter.reset();
      this.options.performance.increment("frameGaps");
      this.options.onError("La captura se interrumpió. Repite la seña completa con las manos visibles.", "frame-gap");
    }
    this.lastFrameAt = now;
    const update = this.segmenter.push(landmarks, features, now);
    if (update.kind !== "ready") {
      this.options.onProgress(update.kind === "collecting" ? update.progress : 0);
      return;
    }

    // Observe rest while inference runs instead of adding its duration to the cooldown.
    this.segmenter.beginCooldown(now);
    this.options.performance.record("observationMs", now - update.startedAtMs);
    if (update.visibleHandFrames < update.sequence.length / 2) {
      this.options.performance.increment("missingHands");
      this.options.onError("No hubo manos visibles en suficientes fotogramas. Centra las manos y vuelve a intentarlo.", "missing-hands");
      return;
    }

    const segment: Segment = {
      sequence: update.sequence,
      startedAt: update.startedAtMs,
      endedAt: now,
      generation: this.generation,
    };
    if (this.busy) {
      if (this.pending) {
        this.options.performance.increment("overloaded");
        this.options.onError("El dispositivo no alcanza el ritmo de captura. Haz una pausa y revisa la transcripción antes de continuar.", "overloaded");
      } else {
        this.pending = segment;
      }
      return;
    }
    void this.run(segment);
  }

  private async run(segment: Segment): Promise<void> {
    this.busy = true;
    const startedAt = this.now();
    this.options.performance.record("queueMs", startedAt - segment.endedAt);
    this.options.onProcessing();
    try {
      const prediction = await this.options.classifier.classify(segment.sequence);
      if (this.active && segment.generation === this.generation) {
        const completedAt = this.now();
        this.options.performance.record("inferenceMs", completedAt - startedAt);
        this.options.performance.record("segmentToPredictionMs", completedAt - segment.startedAt);
        this.options.onPrediction(prediction);
      }
    } catch (cause) {
      if (this.active && segment.generation === this.generation) {
        this.options.performance.increment("inferenceErrors");
        this.options.onError(cause instanceof Error ? cause.message : "Falló la inferencia local.", "inference");
      }
    } finally {
      this.busy = false;
      const next = this.pending;
      this.pending = null;
      if (next && this.active && next.generation === this.generation) {
        if (this.now() - next.endedAt > 2_000) {
          this.options.performance.increment("stale");
          this.options.onError("Una captura quedó atrasada y se descartó. Repite la seña y revisa la transcripción.", "stale");
        } else {
          void this.run(next);
        }
      }
    }
  }
}
