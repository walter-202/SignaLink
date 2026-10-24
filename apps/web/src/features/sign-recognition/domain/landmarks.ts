export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface LandmarkFrame {
  pose: LandmarkPoint[] | null;
  leftHand: LandmarkPoint[] | null;
  rightHand: LandmarkPoint[] | null;
  timestampMs: number;
}

export const LSB_V4_FEATURE_CONTRACT = Object.freeze({
  featureSchema: "lsb-v4-138-v1",
  preprocessorId: "lsb-v4-features-v1",
  normalization: "hand-min-xy+nose-distance+pose-angle-over-2pi-v1",
  landmarkOrder: Object.freeze(["right-hand-xy", "right-hand-nose-distance", "pose-angles-11-to-22", "left-hand-xy", "left-hand-nose-distance"]),
  featureCount: 138,
});

export type SignFeatureExtractor = (frame: LandmarkFrame) => Float32Array;

export const LSB_SEQUENCE_LENGTH = 30;
export const LSB_FEATURE_COUNT = 138;

const POSE_ANGLE_INDICES = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const;
const RIGHT_HAND_OFFSET = 0;
const RIGHT_DISTANCE_OFFSET = 42;
const POSE_ANGLE_OFFSET = 63;
const LEFT_HAND_OFFSET = 75;
const LEFT_DISTANCE_OFFSET = 117;
const FALLBACK_NOSE = { x: 0.5, y: 0.2 };

function getNose(pose: LandmarkPoint[] | null): { x: number; y: number } {
  const nose = pose?.[0];
  return nose ? { x: nose.x, y: nose.y } : FALLBACK_NOSE;
}

function writeNormalizedHand(
  features: Float32Array,
  offset: number,
  hand: LandmarkPoint[] | null,
): void {
  if (!hand || hand.length === 0) return;

  const count = Math.min(hand.length, 21);
  let minX = hand[0].x;
  let minY = hand[0].y;
  for (let index = 0; index < count; index += 1) {
    const point = hand[index];
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
  }

  for (let index = 0; index < count; index += 1) {
    const point = hand[index];
    features[offset + index * 2] = point.x - minX;
    features[offset + index * 2 + 1] = point.y - minY;
  }
}

function writeHandDistances(
  features: Float32Array,
  offset: number,
  hand: LandmarkPoint[] | null,
  nose: { x: number; y: number },
): void {
  if (!hand) return;

  const count = Math.min(hand.length, 21);
  for (let index = 0; index < count; index += 1) {
    const point = hand[index];
    features[offset + index] = Math.hypot(point.x - nose.x, point.y - nose.y);
  }
}

function writePoseAngles(
  features: Float32Array,
  pose: LandmarkPoint[] | null,
  nose: { x: number; y: number },
): void {
  if (!pose) return;

  POSE_ANGLE_INDICES.forEach((poseIndex, index) => {
    const point = pose[poseIndex];
    if (!point) return;
    features[POSE_ANGLE_OFFSET + index] = Math.atan2(
      point.y - nose.y,
      point.x - nose.x,
    ) / (2 * Math.PI);
  });
}

export function extractLsbFeatures(frame: LandmarkFrame): Float32Array {
  const features = new Float32Array(LSB_FEATURE_COUNT);
  const nose = getNose(frame.pose);

  writeNormalizedHand(features, RIGHT_HAND_OFFSET, frame.rightHand);
  writeHandDistances(features, RIGHT_DISTANCE_OFFSET, frame.rightHand, nose);
  writePoseAngles(features, frame.pose, nose);
  writeNormalizedHand(features, LEFT_HAND_OFFSET, frame.leftHand);
  writeHandDistances(features, LEFT_DISTANCE_OFFSET, frame.leftHand, nose);

  return features;
}
