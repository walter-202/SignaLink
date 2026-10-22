import { describe, expect, it } from "vitest";
import {
  LSB_FEATURE_COUNT,
  extractLsbFeatures,
  type LandmarkFrame,
  type LandmarkPoint,
} from "./landmarks";

function point(x: number, y: number, z = 0, visibility = 1): LandmarkPoint {
  return { x, y, z, visibility };
}

function hand(base: LandmarkPoint): LandmarkPoint[] {
  return Array.from({ length: 21 }, (_, index) => (
    index === 0 ? base : point(base.x, base.y)
  ));
}

function poseWithNose(nose: LandmarkPoint = point(0.5, 0.2)): LandmarkPoint[] {
  return Array.from({ length: 33 }, (_, index) => (
    index === 0 ? nose : point(nose.x, nose.y)
  ));
}

function frame(overrides: Partial<LandmarkFrame> = {}): LandmarkFrame {
  return {
    pose: null,
    leftHand: null,
    rightHand: null,
    timestampMs: 0,
    ...overrides,
  };
}

describe("extractLsbFeatures", () => {
  it("returns 138 zeros when no landmarks are visible", () => {
    const features = extractLsbFeatures(frame());

    expect(features).toHaveLength(LSB_FEATURE_COUNT);
    expect(features).toEqual(new Float32Array(LSB_FEATURE_COUNT));
  });

  it("normalizes the right hand and measures distances to the nose", () => {
    const rightHand = hand(point(0.1, 0.4));
    rightHand[1] = point(0.2, 0.5);

    const features = extractLsbFeatures(frame({ pose: poseWithNose(), rightHand }));

    expect(features[0]).toBeCloseTo(0);
    expect(features[1]).toBeCloseTo(0);
    expect(features[2]).toBeCloseTo(0.1);
    expect(features[3]).toBeCloseTo(0.1);
    expect(features[42]).toBeCloseTo(Math.hypot(0.4, 0.2));
    expect(features[43]).toBeCloseTo(Math.hypot(0.3, 0.3));
    expect(features.slice(75)).toEqual(new Float32Array(63));
  });

  it("keeps the left hand in its own block and normalizes pose angles", () => {
    const leftHand = hand(point(0.6, 0.3));
    leftHand[1] = point(0.7, 0.4);
    const pose = poseWithNose();
    pose[11] = point(0.5, 0.4);
    pose[13] = point(0.5, 0.0);

    const features = extractLsbFeatures(frame({ pose, leftHand }));

    expect(features[75]).toBeCloseTo(0);
    expect(features[76]).toBeCloseTo(0);
    expect(features[77]).toBeCloseTo(0.1);
    expect(features[78]).toBeCloseTo(0.1);
    expect(features[63]).toBeCloseTo(0.25);
    expect(features[64]).toBeCloseTo(0);
    expect(features[65]).toBeCloseTo(-0.25);
    expect(features[117]).toBeCloseTo(Math.hypot(0.1, 0.1));
    expect(features.slice(0, 63)).toEqual(new Float32Array(63));
  });

  it("uses the fallback nose when the pose is missing", () => {
    const rightHand = hand(point(0.5, 0.2));
    rightHand[1] = point(0.6, 0.3);

    const features = extractLsbFeatures(frame({ rightHand }));

    expect(features[42]).toBeCloseTo(0);
    expect(features[43]).toBeCloseTo(Math.hypot(0.1, 0.1));
    expect(features.slice(63, 75)).toEqual(new Float32Array(12));
  });

  it("ignores extra hand landmarks beyond the 21-point contract", () => {
    const rightHand = hand(point(0.2, 0.2));
    rightHand.push(point(0.1, 0.1));

    const features = extractLsbFeatures(frame({ pose: poseWithNose(), rightHand }));

    expect(features[0]).toBeCloseTo(0);
    expect(features[2]).toBeCloseTo(0);
    expect(features[42]).toBeCloseTo(Math.hypot(0.3, 0));
  });
});
