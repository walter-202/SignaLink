/**
 * Normalizes an animation name so a clip exported as "Armature|HOLA",
 * "hola" or "HOLA_" can be matched without guessing a different sign.
 */
export function normalizeAnimationName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^ARMATURE\|/, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Finds the exact clip that corresponds to a catalog animation identifier.
 * Returns null instead of falling back to the first available clip: playing a
 * different sign under the requested expression would be misleading.
 */
export function resolveAnimationClip(
  clips: readonly string[],
  animationClipId: string | null,
): string | null {
  if (!animationClipId) return null;
  const expected = normalizeAnimationName(animationClipId);
  if (!expected) return null;
  return (
    clips.find((clip) => normalizeAnimationName(clip) === expected) ?? null
  );
}
