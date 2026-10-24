// Compatibility entry point for the original baseline. New composition uses the model registry.
import { LSB_REFERENCE_LABELS, LSB_REFERENCE_V4 } from "../domain/model-catalog";
import type { RecognitionPerformance } from "../application/recognition-performance";
import { decodeLogits, OnnxSequenceClassifier } from "./onnx-sequence-classifier";

export function selectTopClass(logits: ArrayLike<number>, labels: readonly string[] = LSB_REFERENCE_LABELS) {
  const { label, classIndex, confidence } = decodeLogits(logits, labels);
  return { label, classIndex, confidence };
}

export class OnnxLsbReferenceClassifier extends OnnxSequenceClassifier {
  constructor(metrics?: RecognitionPerformance) { super(LSB_REFERENCE_V4, metrics); }
}
