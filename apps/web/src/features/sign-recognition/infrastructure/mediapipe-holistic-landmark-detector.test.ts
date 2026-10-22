import { describe, expect, it } from "vitest";
import { mapHolisticResult } from "./mediapipe-holistic-landmark-detector";

const landmark = (x: number, y: number, z: number, visibility: number) => ({
  x,
  y,
  z,
  visibility,
});

describe("mapHolisticResult", () => {
  it("maps only the first detected pose and hands to plain landmarks", () => {
    const result = mapHolisticResult({
      poseLandmarks: [[landmark(0.5, 0.2, -0.1, 0.99)]],
      leftHandLandmarks: [],
      rightHandLandmarks: [[landmark(0.2, 0.3, 0.01, 0.8)]],
    }, 1234);

    expect(result).toEqual({
      pose: [{ x: 0.5, y: 0.2, z: -0.1, visibility: 0.99 }],
      leftHand: null,
      rightHand: [{ x: 0.2, y: 0.3, z: 0.01, visibility: 0.8 }],
      timestampMs: 1234,
    });
  });

  it("returns nulls when the model does not detect a person", () => {
    const result = mapHolisticResult({
      poseLandmarks: [],
      leftHandLandmarks: undefined,
      rightHandLandmarks: [],
    }, 42);

    expect(result).toEqual({
      pose: null,
      leftHand: null,
      rightHand: null,
      timestampMs: 42,
    });
  });
});
