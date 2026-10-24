import type { LandmarkFrame, LandmarkPoint } from "../domain/landmarks";

export interface ContinuousSignSegmenterOptions {
  sequenceLength?: number;
  motionThreshold?: number;
  restThreshold?: number;
  restDurationMs?: number;
  maxCooldownMs?: number;
  triggerFrames?: number;
}

export type ContinuousSignSegmenterUpdate =
  | { kind: "waiting" }
  | { kind: "collecting"; progress: number }
  | { kind: "ready"; sequence: Float32Array[]; visibleHandFrames: number; startedAtMs: number };

type SegmenterPhase = "waiting" | "collecting" | "cooling";

const DEFAULTS = {
  sequenceLength: 30,
  motionThreshold: 0.012,
  restThreshold: 0.006,
  restDurationMs: 350,
  maxCooldownMs: 1_200,
  triggerFrames: 2,
} as const;

function hasVisibleHands(frame: LandmarkFrame): boolean {
  return Boolean(frame.leftHand?.length || frame.rightHand?.length);
}

function handMotion(previous: LandmarkPoint[] | null, current: LandmarkPoint[] | null): number | null {
  if (!previous?.length || !current?.length) return null;
  const count = Math.min(previous.length, current.length);
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const before = previous[index];
    const after = current[index];
    if (!before || !after) return null;
    total += Math.hypot(after.x - before.x, after.y - before.y);
  }
  return total / count;
}

export function measureHandMotion(previous: LandmarkFrame | null, current: LandmarkFrame): number {
  if (!previous) return 0;
  const right = handMotion(previous.rightHand, current.rightHand);
  const left = handMotion(previous.leftHand, current.leftHand);
  return Math.max(right ?? 0, left ?? 0);
}

export class ContinuousSignSegmenter {
  private readonly sequenceLength: number;
  private readonly motionThreshold: number;
  private readonly restThreshold: number;
  private readonly restDurationMs: number;
  private readonly maxCooldownMs: number;
  private readonly triggerFrames: number;
  private phase: SegmenterPhase = "waiting";
  private frames: Float32Array[] = [];
  private visibleHandFrames = 0;
  private previousLandmarks: LandmarkFrame | null = null;
  private previousFeatures: Float32Array | null = null;
  private previousVisibleHands = false;
  private motionStreak = 0;
  private restStartedAt: number | null = null;
  private cooldownStartedAt: number | null = null;
  private previousAtMs = 0;
  private startedAtMs = 0;

  constructor(options: ContinuousSignSegmenterOptions = {}) {
    this.sequenceLength = options.sequenceLength ?? DEFAULTS.sequenceLength;
    this.motionThreshold = options.motionThreshold ?? DEFAULTS.motionThreshold;
    this.restThreshold = options.restThreshold ?? DEFAULTS.restThreshold;
    this.restDurationMs = options.restDurationMs ?? DEFAULTS.restDurationMs;
    this.maxCooldownMs = options.maxCooldownMs ?? DEFAULTS.maxCooldownMs;
    this.triggerFrames = options.triggerFrames ?? DEFAULTS.triggerFrames;
  }

  reset(): void {
    this.phase = "waiting";
    this.frames = [];
    this.visibleHandFrames = 0;
    this.previousLandmarks = null;
    this.previousFeatures = null;
    this.previousVisibleHands = false;
    this.motionStreak = 0;
    this.restStartedAt = null;
    this.cooldownStartedAt = null;
    this.previousAtMs = 0;
    this.startedAtMs = 0;
  }

  beginCooldown(now: number): void {
    this.phase = "cooling";
    this.frames = [];
    this.visibleHandFrames = 0;
    this.motionStreak = 0;
    this.restStartedAt = null;
    this.cooldownStartedAt = now;
  }

  push(landmarks: LandmarkFrame, features: Float32Array, now: number): ContinuousSignSegmenterUpdate {
    const previousFeatures = this.previousFeatures;
    const previousAtMs = this.previousAtMs;
    const previousVisibleHands = this.previousVisibleHands;
    const motion = measureHandMotion(this.previousLandmarks, landmarks);
    const visibleHands = hasVisibleHands(landmarks);

    this.previousLandmarks = landmarks;
    this.previousFeatures = new Float32Array(features);
    this.previousVisibleHands = visibleHands;
    this.previousAtMs = now;

    if (this.phase === "collecting") {
      this.frames.push(new Float32Array(features));
      if (visibleHands) this.visibleHandFrames += 1;
      if (this.frames.length >= this.sequenceLength) {
        return {
          kind: "ready",
          sequence: this.frames.slice(-this.sequenceLength),
          visibleHandFrames: this.visibleHandFrames,
          startedAtMs: this.startedAtMs,
        };
      }
      return { kind: "collecting", progress: this.frames.length };
    }

    if (this.phase === "cooling") {
      if (motion < this.restThreshold) {
        this.restStartedAt ??= now;
      } else {
        this.restStartedAt = null;
      }

      const restedLongEnough = this.restStartedAt !== null && now - this.restStartedAt >= this.restDurationMs;
      const cooldownExpired = this.cooldownStartedAt !== null && now - this.cooldownStartedAt >= this.maxCooldownMs;
      if (!restedLongEnough && !cooldownExpired) return { kind: "waiting" };

      this.phase = "waiting";
      this.motionStreak = 0;
      this.cooldownStartedAt = null;
      this.restStartedAt = null;
    }

    if (!visibleHands) {
      this.motionStreak = 0;
      return { kind: "waiting" };
    }

    if (motion >= this.motionThreshold) {
      this.motionStreak += 1;
    } else {
      this.motionStreak = 0;
      return { kind: "waiting" };
    }

    if (this.motionStreak < this.triggerFrames) return { kind: "waiting" };

    this.phase = "collecting";
    this.startedAtMs = previousFeatures && previousVisibleHands ? previousAtMs : now;
    this.frames = [];
    this.visibleHandFrames = 0;
    this.motionStreak = 0;

    if (previousFeatures && previousVisibleHands) {
      this.frames.push(previousFeatures);
      this.visibleHandFrames += 1;
    }
    this.frames.push(new Float32Array(features));
    if (visibleHands) this.visibleHandFrames += 1;

    return { kind: "collecting", progress: this.frames.length };
  }
}
