import { describe, expect, it } from "vitest";
import { LSB_V4_FEATURE_CONTRACT } from "../domain/landmarks";
import { LSB_REFERENCE_V4 } from "../domain/model-catalog";
import { createBrowserRecognitionRuntime } from "../infrastructure/browser-recognition-runtime";
import { ModelRegistry } from "./model-registry";

const capability = { ...LSB_V4_FEATURE_CONTRACT, adapterId: "onnx-sequence-v1", format: "onnx", runtime: "onnx-wasm" };
const registry = (value: unknown) => new ModelRegistry([value], [capability]);

describe("ModelRegistry", () => {
  it("keeps execution approval separate from linguistic validation and accepts compatible shorter windows", () => {
    const model = registry({ ...LSB_REFERENCE_V4, inputShape: [1, 16, 138] }).resolve(LSB_REFERENCE_V4.id);
    expect(model.inputShape).toEqual([1, 16, 138]);
    expect(model.executionApproved).toBe(true);
    expect(model.validationStatus).toBe("experimental");
  });

  it("requires a reviewed binding before accepting a different feature schema", () => {
    const alternate = { ...LSB_REFERENCE_V4, id: "test-three-features", featureSchema: "test-three-v1",
      preprocessorId: "test-extractor", normalization: "test-normalization", landmarkOrder: ["test-order"],
      inputShape: [1, 4, 3] };
    const alternateCapability = { ...capability, featureSchema: alternate.featureSchema,
      preprocessorId: alternate.preprocessorId, normalization: alternate.normalization,
      landmarkOrder: alternate.landmarkOrder, featureCount: 3 };
    expect(() => registry(alternate).resolve(alternate.id)).toThrow("incompatible");
    expect(new ModelRegistry([alternate], [alternateCapability]).resolve(alternate.id).inputShape).toEqual([1, 4, 3]);
  });

  it.each([
    { manifestVersion: 2 }, { sha256: "unverified" }, { inputShape: [1, 0, 138] },
    { labels: ["A", "A"], outputClasses: 2 }, { outputClasses: 1 },
    { modelUrl: "https://example.com/model.onnx" }, { modelUrl: "/models/../private/model.onnx" },
    { confidenceThreshold: 2 }, { minimumMargin: Number.NaN }, { normalization: undefined },
  ])("rejects malformed manifests before any adapter is invoked: %o", (override) => {
    expect(() => registry({ ...LSB_REFERENCE_V4, ...override })).toThrow();
  });

  it.each([
    { featureSchema: "different" }, { preprocessorId: "missing" }, { normalization: "different" },
    { landmarkOrder: [...LSB_REFERENCE_V4.landmarkOrder].reverse() }, { runtime: "unknown" },
    { adapterId: "unknown" }, { inputShape: [1, 30, 140] },
  ])("blocks unsupported tensor/feature contracts without falling back to LSB: %o", (override) => {
    expect(() => registry({ ...LSB_REFERENCE_V4, ...override }).resolve(LSB_REFERENCE_V4.id)).toThrow("incompatible");
  });

  it("blocks unknown IDs, duplicate IDs and models disabled for execution", () => {
    expect(() => registry(LSB_REFERENCE_V4).resolve("unknown-model")).toThrow("no registrado");
    expect(() => new ModelRegistry([LSB_REFERENCE_V4, LSB_REFERENCE_V4], [capability])).toThrow("duplicado");
    const disabled = registry({ ...LSB_REFERENCE_V4, executionApproved: false });
    expect(() => disabled.resolve(LSB_REFERENCE_V4.id)).toThrow("no está habilitado");
    expect(disabled.list()).toHaveLength(1);
    expect(disabled.available()).toHaveLength(0);
  });

  it("snapshots and freezes manifests so later mutations cannot change label mappings", () => {
    const original = { ...LSB_REFERENCE_V4, labels: [...LSB_REFERENCE_V4.labels] as string[] };
    const catalog = registry(original);
    original.labels[0] = "CHANGED";
    const model = catalog.resolve(original.id);
    expect(model.labels[0]).toBe("O");
    expect(Object.isFrozen(model.labels)).toBe(true);
    expect(Object.isFrozen(model.inputShape)).toBe(true);
  });

  it("resolves the reviewed browser binding without loading an ONNX runtime or inventing a second model", () => {
    const runtime = createBrowserRecognitionRuntime();
    expect(runtime.listModels()).toHaveLength(1);
    expect(runtime.resolveModel(LSB_REFERENCE_V4.id).manifest.sha256).toBe(LSB_REFERENCE_V4.sha256);
    expect(runtime.resolveModel(LSB_REFERENCE_V4.id)).toBe(runtime.resolveModel(LSB_REFERENCE_V4.id));
    expect(() => runtime.resolveModel("signbart")).toThrow("no registrado");
  });
});
