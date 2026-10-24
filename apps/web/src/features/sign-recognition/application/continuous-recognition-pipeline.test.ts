import { describe, expect, it, vi } from "vitest";
import type { LandmarkFrame } from "../domain/landmarks";
import type { SignClassification } from "./ports/sign-classifier";
import { ContinuousRecognitionPipeline } from "./continuous-recognition-pipeline";
import { RecognitionPerformance } from "./recognition-performance";

const prediction: SignClassification = { label: "HOLA", classIndex: 39, confidence: 0.91 };

function setup() {
  let now = 0;
  const resolves: Array<(value: SignClassification) => void> = [];
  const rejects: Array<(cause: Error) => void> = [];
  const classify = vi.fn<(sequence: readonly Float32Array[]) => Promise<SignClassification>>(() => new Promise<SignClassification>((resolve, reject) => { resolves.push(resolve); rejects.push(reject); }));
  const metrics = new RecognitionPerformance();
  const onPrediction = vi.fn();
  const onError = vi.fn();
  const pipeline = new ContinuousRecognitionPipeline({
    classifier: { classify, initialize: async () => undefined, close: () => undefined },
    performance: metrics,
    onPrediction,
    onProgress: vi.fn(),
    onProcessing: vi.fn(),
    onError,
    now: () => now,
  });
  let position = 0.1;
  function push(offset: number, delta = 33) {
    now += delta;
    const frame: LandmarkFrame = {
      timestampMs: now, pose: null, leftHand: null,
      rightHand: Array.from({ length: 21 }, () => ({ x: offset, y: 0.2, z: 0 })),
    };
    pipeline.push(frame, new Float32Array(138).fill(offset));
  }
  function feed() {
    // Rest releases the segmenter cooldown, including during an outstanding inference.
    for (let i = 0; i < 14; i++) push(position);
    push(position += 0.03);
    push(position += 0.03);
    for (let i = 0; i < 28; i++) push(position);
  }
  pipeline.start();
  return { pipeline, classify, resolves, rejects, metrics, onPrediction, onError, feed, push, advance: (ms: number) => { now += ms; } };
}

describe("ContinuousRecognitionPipeline", () => {
  it("captures a second full sequence during inference and serializes classification", async () => {
    const test = setup();
    test.feed();
    test.feed();
    expect(test.classify).toHaveBeenCalledTimes(1);
    expect(test.classify.mock.calls[0]?.length).toBe(1);
    test.resolves[0]!(prediction);
    await vi.waitFor(() => expect(test.classify).toHaveBeenCalledTimes(2));
    test.resolves[1]!({ ...prediction, label: "YO" });
    await vi.waitFor(() => expect(test.onPrediction).toHaveBeenCalledTimes(2));
    const sequences = test.classify.mock.calls;
    expect(sequences.every(([sequence]) => sequence.length === 30 && sequence.every((frame) => frame.length === 138))).toBe(true);
    expect(sequences[0]![0][0]![0]).toBeCloseTo(0.13);
    expect(sequences[1]![0][0]![0]).toBeCloseTo(0.19);
    expect(test.metrics.snapshot().timings.observationMs?.total).toBe(2);
  });

  it("bounds the queue and explicitly reports overflow instead of growing memory", () => {
    const test = setup();
    test.feed(); test.feed(); test.feed();
    expect(test.classify).toHaveBeenCalledTimes(1);
    expect(test.onError).toHaveBeenCalledWith(expect.stringContaining("ritmo"), "overloaded");
    expect(test.metrics.snapshot().counters.overloaded).toBe(1);
  });

  it("discards late results on stop and keeps the inference lock across restart", async () => {
    const test = setup();
    test.feed();
    test.pipeline.stop();
    test.pipeline.start();
    test.feed();
    expect(test.classify).toHaveBeenCalledTimes(1);
    test.resolves[0]!(prediction);
    await vi.waitFor(() => expect(test.classify).toHaveBeenCalledTimes(2));
    expect(test.onPrediction).not.toHaveBeenCalled();
    test.resolves[1]!(prediction);
    await vi.waitFor(() => expect(test.onPrediction).toHaveBeenCalledOnce());
  });

  it("recovers from a failed inference without losing the pending sequence", async () => {
    const test = setup();
    test.feed(); test.feed();
    test.rejects[0]!(new Error("runtime failure"));
    await vi.waitFor(() => expect(test.classify).toHaveBeenCalledTimes(2));
    expect(test.onError).toHaveBeenCalledWith("runtime failure", "inference");
    test.resolves[1]!(prediction);
    await vi.waitFor(() => expect(test.onPrediction).toHaveBeenCalledOnce());
    expect(test.metrics.snapshot().counters.inferenceErrors).toBe(1);
  });

  it("does not join observations across a suspended camera or hidden tab", () => {
    const test = setup();
    test.push(0.1); test.push(0.13); test.push(0.16);
    for (let i = 0; i < 10; i++) test.push(0.16);
    test.advance(1_001);
    for (let i = 0; i < 20; i++) test.push(0.16);
    expect(test.classify).not.toHaveBeenCalled();
    expect(test.onError).toHaveBeenCalledWith(expect.stringContaining("interrumpió"), "frame-gap");
    expect(test.metrics.snapshot().counters.frameGaps).toBe(1);
    test.push(0.19); test.push(0.22);
    for (let i = 0; i < 28; i++) test.push(0.22);
    expect(test.classify).toHaveBeenCalledOnce();
  });

  it("does not display queued captures more than two seconds late", async () => {
    const test = setup();
    test.feed(); test.feed();
    test.advance(2_001);
    test.resolves[0]!(prediction);
    await vi.waitFor(() => expect(test.onError).toHaveBeenCalledWith(expect.stringContaining("atrasada"), "stale"));
    expect(test.classify).toHaveBeenCalledTimes(1);
    expect(test.metrics.snapshot().counters.stale).toBe(1);
  });
});

describe("RecognitionPerformance", () => {
  it("bounds measurements, computes percentiles and exports only numeric aggregates", () => {
    const metrics = new RecognitionPerformance();
    for (let ms = 1; ms <= 200; ms++) metrics.record("inferenceMs", ms);
    metrics.record("inferenceMs", Number.NaN);
    metrics.record("inferenceMs", -1);
    metrics.increment("uncertain");
    expect(metrics.snapshot().timings.inferenceMs).toEqual({ total: 200, samples: 120, mean: 140.5, p50: 140, p95: 194 });
    expect(metrics.snapshot().counters).toEqual({ uncertain: 1 });
    expect(metrics.snapshot()).not.toHaveProperty("sequence");
    metrics.reset();
    expect(metrics.snapshot().timings).toEqual({});
    expect(metrics.snapshot().processedFps).toBeNull();
  });
});
