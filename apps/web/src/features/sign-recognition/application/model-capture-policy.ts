import type { SignClassification } from "./ports/sign-classifier";

export interface CaptureModelIdentity {
  id: string;
  version: string;
}

export interface AcceptedCaptureLabel {
  label: string;
  at: number;
}

export type ModelCaptureDecision =
  | { kind: "model-mismatch" }
  | { kind: "uncertain" }
  | { kind: "duplicate" }
  | { kind: "accepted"; next: AcceptedCaptureLabel };

/** Shared UI policy for turning an experimental prediction into an editable proposal. */
export function decideModelCapture(
  prediction: SignClassification,
  model: CaptureModelIdentity,
  previous: AcceptedCaptureLabel | null,
  now: number,
  duplicateWindowMs = 900,
): ModelCaptureDecision {
  if (prediction.modelId !== model.id || prediction.modelVersion !== model.version) {
    return { kind: "model-mismatch" };
  }
  if (!Number.isFinite(prediction.confidence) || prediction.decision !== "candidate" || prediction.label.length === 0) {
    return { kind: "uncertain" };
  }
  if (previous && previous.label === prediction.label && now - previous.at < duplicateWindowMs) {
    return { kind: "duplicate" };
  }
  return { kind: "accepted", next: { label: prediction.label, at: now } };
}
