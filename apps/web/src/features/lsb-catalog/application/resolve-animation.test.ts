import { describe, expect, it } from "vitest";
import {
  normalizeAnimationName,
  resolveAnimationClip,
} from "./resolve-animation";

describe("normalizeAnimationName", () => {
  it("removes the Blender armature prefix, case, accents and separators", () => {
    expect(normalizeAnimationName("Armature|BUENOS_DIAS")).toBe("BUENOS_DIAS");
    expect(normalizeAnimationName("armature|buenos días")).toBe("BUENOS_DIAS");
    expect(normalizeAnimationName("  ¿Cómo estás?  ")).toBe("COMO_ESTAS");
  });

  it("normalizes the trailing underscore used by the IVILSB mapping", () => {
    expect(normalizeAnimationName("PUEDO_")).toBe("PUEDO");
  });
});

describe("resolveAnimationClip", () => {
  it("returns the exact clip for the requested identifier", () => {
    expect(
      resolveAnimationClip(
        ["Armature|GRACIAS", "Armature|HOLA", "Armature|CHAU"],
        "HOLA",
      ),
    ).toBe("Armature|HOLA");
  });

  it("does not fall back to a different sign", () => {
    expect(
      resolveAnimationClip(["Armature|GRACIAS", "Armature|CHAU"], "HOLA"),
    ).toBeNull();
  });

  it("does not accept a clip whose name only starts with the identifier", () => {
    expect(
      resolveAnimationClip(["Armature|BUENOS_DIASZ"], "BUENOS_DIAS"),
    ).toBeNull();
  });

  it("returns null for an expression without a mapped animation", () => {
    expect(resolveAnimationClip(["Armature|HOLA"], null)).toBeNull();
  });
});
