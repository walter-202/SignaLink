import { describe, expect, it } from "vitest";
import type { LandmarkFrame, LandmarkPoint } from "../domain/landmarks";
import { ContinuousSignSegmenter, measureHandMotion } from "./continuous-sign-segmenter";

function createHand(offsetX: number): LandmarkPoint[] {
  return Array.from({ length: 21 }, (_, index) => ({
    x: offsetX + index * 0.001,
    y: 0.2 + index * 0.001,
    z: 0,
  }));
}

function createFrame(offsetX: number, timestampMs = 0): LandmarkFrame {
  return {
    pose: null,
    leftHand: null,
    rightHand: createHand(offsetX),
    timestampMs,
  };
}

function createFeatures(seed = 0): Float32Array {
  const features = new Float32Array(138);
  features[0] = seed;
  return features;
}

describe("measureHandMotion", () => {
  it("measures the largest average hand displacement between frames", () => {
    expect(measureHandMotion(createFrame(0.1), createFrame(0.13))).toBeCloseTo(0.03, 8);
  });

  it("returns zero when a hand is missing in either frame", () => {
    expect(measureHandMotion(createFrame(0.1), { ...createFrame(0.2), rightHand: null })).toBe(0);
  });
});

describe("ContinuousSignSegmenter", () => {
  it("does not start a segment for hands at rest", () => {
    const segmenter = new ContinuousSignSegmenter();
    let update = segmenter.push(createFrame(0.1), createFeatures(), 0);

    for (let index = 1; index < 12; index += 1) {
      update = segmenter.push(createFrame(0.101), createFeatures(index), index * 33);
    }

    expect(update).toEqual({ kind: "waiting" });
  });

  it("starts on motion and returns exactly 30 frames without requiring continued movement", () => {
    const segmenter = new ContinuousSignSegmenter();
    segmenter.push(createFrame(0.1), createFeatures(), 0);

    let update = segmenter.push(createFrame(0.12), createFeatures(1), 33);
    expect(update).toEqual({ kind: "waiting" });
    update = segmenter.push(createFrame(0.14), createFeatures(2), 66);
    expect(update).toEqual({ kind: "collecting", progress: 2 });

    for (let index = 3; index <= 30; index += 1) {
      update = segmenter.push(createFrame(0.14), createFeatures(index), index * 33);
    }

    expect(update.kind).toBe("ready");
    if (update.kind !== "ready") return;
    expect(update.sequence).toHaveLength(30);
    expect(update.visibleHandFrames).toBe(30);
  });

  it("waits for rest after a segment before accepting another sign", () => {
    const segmenter = new ContinuousSignSegmenter();
    let now = 0;
    segmenter.push(createFrame(0.1), createFeatures(), now);
    segmenter.push(createFrame(0.13), createFeatures(), (now += 33));
    segmenter.push(createFrame(0.16), createFeatures(), (now += 33));

    for (let index = 0; index < 28; index += 1) {
      now += 33;
      segmenter.push(createFrame(0.16), createFeatures(), now);
    }
    segmenter.beginCooldown(now);

    now += 33;
    expect(segmenter.push(createFrame(0.16), createFeatures(), now)).toEqual({ kind: "waiting" });
    now += 400;
    expect(segmenter.push(createFrame(0.16), createFeatures(), now)).toEqual({ kind: "waiting" });
    expect(segmenter.push(createFrame(0.19), createFeatures(), (now += 33))).toEqual({ kind: "waiting" });
    expect(segmenter.push(createFrame(0.22), createFeatures(), (now += 33))).toEqual({ kind: "collecting", progress: 2 });
  });
});
