// Entirely synthetic ledgers. No clips, real identities or permissions exist.
import { createHash } from "node:crypto";
import { corpusDigest } from "../src/evaluation/contracts.mjs";
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function clip(id, split, participantId, labelId = "label-a", kind = "sign") {
  return { id, split, participantId, sessionId: `session-${participantId}`, assetSha256: hash(id),
    durationMs: kind === "sign" ? 3000 : 60_000, kind, labelId: kind === "sign" ? labelId : null,
    onsetMs: kind === "sign" ? 1000 : null, endMs: kind === "sign" ? 2000 : null,
    sourceRef: "synthetic-source", authorizationRef: "synthetic-permission", authorizationStatus: "verified",
    annotationStatus: "reviewed", regionId: "region-1", conditionId: "condition-1", deviceId: "device-1", variantId: "variant-1" };
}
export function corpusFixture() {
  return { schemaVersion: 1, datasetId: "synthetic-corpus", language: "LSB", task: "isolated-sign", evidence: "synthetic",
    labels: ["label-a", "label-b"].map((id) => ({ id, validation: "validated", sourceRef: "synthetic-label-source" })),
    clips: [clip("train-a", "train", "train-person"), clip("train-b", "train", "train-person", "label-b"),
      clip("validation-a", "validation", "validation-person"), clip("validation-b", "validation", "validation-person", "label-b"),
      clip("test-a1", "test", "test-person-1"), clip("test-a2", "test", "test-person-2"),
      clip("test-b1", "test", "test-person-1", "label-b"), clip("test-b2", "test", "test-person-2", "label-b"),
      clip("rest", "test", "test-person-1", null, "rest"), clip("movement", "test", "test-person-2", null, "non-sign")] };
}
export function runFixture(corpus) {
  return { schemaVersion: 1, datasetId: corpus.datasetId, corpusSha256: corpusDigest(corpus), split: "test", evidence: corpus.evidence,
    runId: "synthetic-run", model: { id: "synthetic-model", version: "fixture-v1", sha256: hash("synthetic-weights"), trainingParticipantAudit: "unknown", labelIds: corpus.labels.map((label) => label.id) },
    pipeline: { version: "synthetic-pipeline", codeRevision: "a".repeat(40), featureSchema: "synthetic-features", preprocessorId: "synthetic-preprocessor",
      inputShape: [1, 30, 138], frameIntervalMs: 33, confidenceThreshold: 0.5, minimumMargin: 0, landmarkModelSha256: hash("synthetic-holistic"),
      landmarkRuntime: "main-thread", delegate: "CPU", classifierRuntime: "onnx-wasm" },
    deviceProfileId: "synthetic-device", browserProfileId: "synthetic-browser", condition: "warm", clock: "realtime-clip-start-ms",
    results: corpus.clips.filter((item) => item.split === "test").map((item) => ({ clipId: item.id, status: "completed", observedUntilMs: item.durationMs,
      proposals: item.kind === "sign" ? [{ labelId: item.labelId, visibleAtMs: 1500 }] : [] })) };
}
