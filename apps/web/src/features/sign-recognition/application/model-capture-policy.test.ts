import { describe, expect, it } from "vitest";
import { decideModelCapture } from "./model-capture-policy";
import type { SignClassification } from "./ports/sign-classifier";

const model = { id: "lsb-reference-v4", version: "4.0.0" };
function candidate(overrides: Partial<SignClassification> = {}): SignClassification {
  return { modelId: model.id, modelVersion: model.version, label: "HOLA", classIndex: 0,
    confidence: 0.8, margin: 0.6, decision: "candidate", ...overrides };
}

describe("decideModelCapture", () => {
  it("accepts an in-policy prediction and suppresses only the same label inside the duplicate window", () => {
    const first = decideModelCapture(candidate(), model, null, 1_000);
    expect(first).toEqual({ kind: "accepted", next: { label: "HOLA", at: 1_000 } });
    expect(decideModelCapture(candidate(), model, { label: "HOLA", at: 1_000 }, 1_899)).toEqual({ kind: "duplicate" });
    expect(decideModelCapture(candidate(), model, { label: "HOLA", at: 1_000 }, 1_900).kind).toBe("accepted");
    expect(decideModelCapture(candidate({ label: "GRACIAS" }), model, { label: "HOLA", at: 1_000 }, 1_100).kind).toBe("accepted");
  });

  it("rejects stale-model, uncertain, non-finite and blank labels from the editable draft", () => {
    expect(decideModelCapture(candidate({ modelVersion: "3.0.0" }), model, null, 0).kind).toBe("model-mismatch");
    expect(decideModelCapture(candidate({ decision: "uncertain" }), model, null, 0).kind).toBe("uncertain");
    expect(decideModelCapture(candidate({ confidence: Number.NaN }), model, null, 0).kind).toBe("uncertain");
    expect(decideModelCapture(candidate({ label: "" }), model, null, 0).kind).toBe("uncertain");
  });
});
