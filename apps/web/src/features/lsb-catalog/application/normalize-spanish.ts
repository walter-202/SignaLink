const DIACRITICS = /[\u0300-\u036f]/g;
const PUNCTUATION = /\p{P}+/gu;
const WHITESPACE = /\s+/g;

/**
 * Normalizes Spanish text for catalog lookups: case, accents, punctuation and
 * repeated spaces. It never changes words, so an unmatched phrase stays unmatched.
 */
export function normalizeSpanish(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(PUNCTUATION, " ")
    .replace(WHITESPACE, " ")
    .trim();
}
