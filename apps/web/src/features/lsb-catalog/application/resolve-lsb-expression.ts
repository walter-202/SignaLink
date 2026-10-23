import { LSB_EXPRESSIONS } from "../domain/lsb-catalog";
import type { LsbExpression } from "../domain/lsb-expression";
import { normalizeSpanish } from "./normalize-spanish";

export type LsbResolution =
  | { status: "empty" }
  | { status: "unknown"; normalizedInput: string }
  | { status: "matched"; normalizedInput: string; expression: LsbExpression };

const byNormalizedSpanish = new Map<string, LsbExpression>();

for (const expression of LSB_EXPRESSIONS) {
  for (const term of [expression.spanish, ...expression.aliases]) {
    const key = normalizeSpanish(term);
    if (key) byNormalizedSpanish.set(key, expression);
  }
}

/**
 * Resolves an exact (normalized) catalog match. It intentionally avoids
 * substring matching so a longer sentence never maps to an unrelated sign.
 */
export function resolveLsbExpression(input: string): LsbResolution {
  const normalizedInput = normalizeSpanish(input);
  if (!normalizedInput) return { status: "empty" };

  const expression = byNormalizedSpanish.get(normalizedInput);
  return expression
    ? { status: "matched", normalizedInput, expression }
    : { status: "unknown", normalizedInput };
}

/** Browsing helper: filters the documented catalog by a normalized fragment. */
export function searchLsbExpressions(query: string): readonly LsbExpression[] {
  const normalizedQuery = normalizeSpanish(query);
  if (!normalizedQuery) return LSB_EXPRESSIONS;

  return LSB_EXPRESSIONS.filter((expression) =>
    normalizeSpanish(expression.spanish).includes(normalizedQuery),
  );
}
