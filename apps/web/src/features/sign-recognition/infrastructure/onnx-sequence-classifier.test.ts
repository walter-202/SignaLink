import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LSB_REFERENCE_V4 } from "../domain/model-catalog";
import type { SignModelManifest } from "../domain/sign-model";
import { decodeModelPrediction, OnnxSequenceClassifier } from "./onnx-sequence-classifier";

const mocks = vi.hoisted(() => {
  const session = {
    inputNames: ["input"], outputNames: ["output"],
    inputMetadata: [{ name: "input", isTensor: true, type: "float32", shape: [1, 4, 3] }],
    outputMetadata: [{ name: "output", isTensor: true, type: "float32", shape: [1, 2] }],
    run: vi.fn(), release: vi.fn(async () => undefined),
  };
  return { session, create: vi.fn(async () => session), tensor: vi.fn() };
});
vi.mock("onnxruntime-web/wasm", () => ({
  env: { wasm: {} }, InferenceSession: { create: mocks.create },
  Tensor: class {
    constructor(type: string, data: Float32Array, dims: number[]) { mocks.tensor(type, data, dims); }
  },
}));

const model: SignModelManifest = {
  ...LSB_REFERENCE_V4, id: "test-short", version: "1.0.0", modelBytes: 4,
  sha256: "0".repeat(64), inputShape: [1, 4, 3], labels: ["A", "B"], outputClasses: 2,
  confidenceThreshold: 0.5, minimumMargin: 0,
};
const frames = () => Array.from({ length: 4 }, () => new Float32Array([1, 2, 3]));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(4))));
  vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new Uint8Array(32).buffer);
  mocks.create.mockResolvedValue(mocks.session);
  mocks.session.inputNames = ["input"];
  mocks.session.inputMetadata[0]!.shape = [1, 4, 3];
  mocks.session.outputMetadata[0]!.shape = [1, 2];
  mocks.session.run.mockResolvedValue({ output: { data: new Float32Array([0, 2]), dims: [1, 2] } });
});

afterEach(() => vi.unstubAllGlobals());

describe("OnnxSequenceClassifier", () => {
  it("uses the selected window, feature count, labels and identity instead of the v4 constants", async () => {
    const classifier = new OnnxSequenceClassifier(model);
    await classifier.initialize();
    const result = await classifier.classify(frames());
    expect(mocks.tensor).toHaveBeenCalledWith("float32", new Float32Array([1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]), [1, 4, 3]);
    expect(result).toMatchObject({ modelId: "test-short", modelVersion: "1.0.0", label: "B", decision: "candidate" });
    expect(result.margin).toBeGreaterThan(0.7);
    classifier.close();
  });

  it("shares simultaneous initialization and does not reopen a closed classifier", async () => {
    const classifier = new OnnxSequenceClassifier(model);
    await Promise.all([classifier.initialize(), classifier.initialize()]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledOnce();
    classifier.close();
    await expect(classifier.initialize()).rejects.toThrow("cerrado");
  });

  it("aborts an obsolete download and prevents its metrics from entering the next model report", async () => {
    const { RecognitionPerformance } = await import("../application/recognition-performance");
    const metrics = new RecognitionPerformance();
    let respond!: (response: Response) => void;
    let requestSignal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn((_url: RequestInfo | URL, options: RequestInit) => {
      requestSignal = options.signal!;
      return new Promise<Response>((resolve) => { respond = resolve; });
    }));
    const classifier = new OnnxSequenceClassifier(model, metrics);
    const loading = classifier.initialize();
    const rejection = expect(loading).rejects.toThrow("cerrado");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    classifier.close();
    expect(requestSignal.aborted).toBe(true);
    metrics.reset();
    respond(new Response(new Uint8Array(4)));
    await rejection;
    expect(metrics.snapshot().timings).toEqual({});
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects incompatible tensor metadata and releases the session", async () => {
    mocks.session.inputMetadata[0]!.shape = [1, 30, 138];
    await expect(new OnnxSequenceClassifier(model).initialize()).rejects.toThrow("dimensiones");
    expect(mocks.session.release).toHaveBeenCalledOnce();
  });

  it("checks file integrity before creating a session", async () => {
    await expect(new OnnxSequenceClassifier({ ...model, sha256: "f".repeat(64) }).initialize()).rejects.toThrow("SHA-256");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects invalid features and wrong sequence lengths before running ONNX", async () => {
    const classifier = new OnnxSequenceClassifier(model);
    await classifier.initialize();
    await expect(classifier.classify(frames().slice(0, 3))).rejects.toThrow("4 fotogramas");
    const invalid = frames(); invalid[0]![0] = Number.NaN;
    await expect(classifier.classify(invalid)).rejects.toThrow("no finitas");
    expect(mocks.session.run).not.toHaveBeenCalled();
    classifier.close();
  });

  it("waits for inference before releasing a model on switch", async () => {
    let complete!: (value: unknown) => void;
    mocks.session.run.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    const classifier = new OnnxSequenceClassifier(model);
    await classifier.initialize();
    const running = classifier.classify(frames());
    await expect(classifier.classify(frames())).rejects.toThrow("en curso");
    classifier.close();
    expect(mocks.session.release).not.toHaveBeenCalled();
    complete({ output: { data: new Float32Array([0, 2]), dims: [1, 2] } });
    await running;
    await vi.waitFor(() => expect(mocks.session.release).toHaveBeenCalledOnce());
  });
});

describe("prediction uncertainty", () => {
  it("rejects an ambiguous top class even when it passes the confidence threshold", () => {
    const result = decodeModelPrediction([0, 0.05], { ...model, minimumMargin: 0.1 });
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.decision).toBe("uncertain");
  });
  it("rejects partially non-finite logits instead of choosing from the remaining classes", () => {
    expect(() => decodeModelPrediction([Number.NaN, 2], model)).toThrow("no válida");
  });
});
