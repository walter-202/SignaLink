import { describe, expect, it } from "vitest";
import {
  LSB_ANIMATION_SOURCE,
  LSB_EXPRESSIONS,
  LSB_OWN_ANIMATION_SOURCE,
  LSB_SOURCE,
} from "../domain/lsb-catalog";
import { normalizeSpanish } from "./normalize-spanish";
import {
  resolveLsbExpression,
  searchLsbExpressions,
} from "./resolve-lsb-expression";

describe("normalizeSpanish", () => {
  it("ignores case, accents, punctuation and repeated spaces", () => {
    expect(normalizeSpanish("  ¡HOLA,   Buenos Días! ")).toBe(
      "hola buenos dias",
    );
  });

  it("keeps an unsupported phrase as words instead of guessing a sign", () => {
    expect(normalizeSpanish("Nos vemos luego")).toBe("nos vemos luego");
  });
});

describe("resolveLsbExpression", () => {
  it("matches a documented greeting with punctuation and accents", () => {
    const result = resolveLsbExpression("¿Cómo estás?");
    expect(result.status).toBe("matched");
    if (result.status !== "matched") return;
    expect(result.expression.spanish).toBe("¿Cómo estás?");
    expect(result.expression.page).toBe(57);
  });

  it("matches regardless of case and missing accents", () => {
    expect(resolveLsbExpression("BUENAS NOCHES")).toMatchObject({
      status: "matched",
      expression: { spanish: "Buenas noches" },
    });
    expect(resolveLsbExpression("como estas")).toMatchObject({
      status: "matched",
    });
  });

  it("returns empty for blank input", () => {
    expect(resolveLsbExpression("   ")).toEqual({ status: "empty" });
  });

  it("does not map a longer sentence to an isolated sign", () => {
    expect(resolveLsbExpression("Hola mundo").status).toBe("unknown");
  });

  it("does not resolve a phrase absent from the source", () => {
    expect(resolveLsbExpression("Bienvenido").status).toBe("unknown");
  });
});

describe("searchLsbExpressions", () => {
  it("filters by normalized fragment", () => {
    expect(
      searchLsbExpressions("buen").map((expression) => expression.spanish),
    ).toEqual(["Buenos días", "Buenas tardes", "Buenas noches"]);
    expect(
      searchLsbExpressions("dias").map((expression) => expression.spanish),
    ).toEqual(["Buenos días"]);
  });

  it("returns the full catalog for an empty query", () => {
    expect(searchLsbExpressions("  ")).toHaveLength(LSB_EXPRESSIONS.length);
  });
});

describe("catalog integrity", () => {
  it("keeps 19 unique greetings from TEMA 1", () => {
    expect(LSB_EXPRESSIONS).toHaveLength(19);
    expect(
      new Set(LSB_EXPRESSIONS.map((expression) => expression.id)).size,
    ).toBe(19);
    expect(
      new Set(LSB_EXPRESSIONS.map((expression) => expression.spanish)).size,
    ).toBe(19);
  });

  it("points every greeting to a page that the source actually covers", () => {
    expect(LSB_SOURCE.pages).toBe("56–58");
    for (const expression of LSB_EXPRESSIONS) {
      expect(expression.page).toBeGreaterThanOrEqual(56);
      expect(expression.page).toBeLessThanOrEqual(58);
    }
  });

  it("keeps IVILSB mappings and marks only HOLA as a bundled provisional clip", () => {
    for (const expression of LSB_EXPRESSIONS) {
      expect(expression.gloss).toBeNull();
      expect(expression.animationClipId).not.toBeNull();
      expect(expression.validation).toBe("sin-revision");
      if (expression.animationClipId === "HOLA") {
        expect(expression.animationSource).toBe("SIGNALINK");
        expect(expression.animationStatus).toBe("provisional");
      } else {
        expect(expression.animationSource).toBe("IVILSB");
        expect(expression.animationStatus).toBe("unavailable");
      }
    }
    expect(LSB_ANIMATION_SOURCE.license).toMatch(
      /no incluye un archivo de licencia/i,
    );
    expect(LSB_OWN_ANIMATION_SOURCE.license).toMatch(/CC0/i);
  });

  it("keeps the exact IVILSB identifiers for ambiguous labels", () => {
    const bySpanish = new Map(
      LSB_EXPRESSIONS.map((expression) => [expression.spanish, expression]),
    );
    expect(bySpanish.get("¿Cómo estás?")?.animationClipId).toBe("COMO_ESTAS");
    expect(bySpanish.get("Puedo")?.animationClipId).toBe("PUEDO_");
    expect(bySpanish.get("Sí")?.animationClipId).toBe("SI");
    expect(bySpanish.get("Más o menos")?.animationClipId).toBe("MAS_O_MENOS");
  });
});
