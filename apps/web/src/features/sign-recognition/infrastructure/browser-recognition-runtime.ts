import { ModelRegistry } from "../application/model-registry";
import type { RecognitionModel, RecognitionRuntime } from "../application/ports/recognition-runtime";
import { extractLsbFeatures, LSB_V4_FEATURE_CONTRACT } from "../domain/landmarks";
import { LSB_REFERENCE_V4 } from "../domain/model-catalog";

/** Composition root: only code-reviewed adapter/preprocessor bindings can execute. */
export function createBrowserRecognitionRuntime(): RecognitionRuntime {
  const registry = new ModelRegistry([LSB_REFERENCE_V4], [{
    ...LSB_V4_FEATURE_CONTRACT,
    adapterId: "onnx-sequence-v1",
    format: "onnx",
    runtime: "onnx-wasm",
  }]);
  const bindings = new Map<string, RecognitionModel>();
  return {
    listModels: () => registry.available(),
    resolveModel(id) {
      const manifest = registry.resolve(id);
      let model = bindings.get(id);
      if (!model) {
        model = Object.freeze({
          manifest,
          extractFeatures: extractLsbFeatures,
          async createClassifier(metrics) {
            const { OnnxSequenceClassifier } = await import("./onnx-sequence-classifier");
            return new OnnxSequenceClassifier(manifest, metrics);
          },
        } satisfies RecognitionModel);
        bindings.set(id, model);
      }
      return model;
    },
  };
}
