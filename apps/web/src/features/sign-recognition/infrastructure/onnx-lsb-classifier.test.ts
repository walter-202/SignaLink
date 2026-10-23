import { describe, expect, it } from "vitest";
import { LSB_REFERENCE_LABELS, LSB_REFERENCE_V4 } from "../domain/model-catalog";
import { selectTopClass } from "./onnx-lsb-classifier";

describe("selectTopClass", () => {
  it("selects the maximum logit and computes a stable softmax confidence", () => {
    expect(selectTopClass([1000, 1001], ["A", "B"])).toEqual({
      label: "B",
      classIndex: 1,
      confidence: expect.closeTo(0.7310585786, 8),
    });
  });

  it("rejects output with a class count that does not match the labels", () => {
    expect(() => selectTopClass([1], ["A", "B"])).toThrow("se esperaban 2");
  });

  it("rejects logits that are not finite", () => {
    expect(() => selectTopClass([Number.NaN], ["A"])).toThrow("predicción no válida");
  });

  it("keeps the upstream model contract and all 58 class labels aligned", () => {
    expect(LSB_REFERENCE_LABELS).toHaveLength(LSB_REFERENCE_V4.outputClasses);
    expect(LSB_REFERENCE_V4.inputShape).toEqual([1, 30, 138]);
    expect(LSB_REFERENCE_LABELS[0]).toBe("O");
    expect(LSB_REFERENCE_LABELS[38]).toBe(" ");
    expect(LSB_REFERENCE_LABELS[39]).toBe("HOLA");
  });
});
