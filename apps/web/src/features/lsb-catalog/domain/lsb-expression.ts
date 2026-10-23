export type LsbValidationStatus = "sin-revision";

export const LSB_VALIDATION_LABELS: Record<LsbValidationStatus, string> = {
  "sin-revision": "Sin revisión lingüística registrada",
};

export type LsbAnimationSource = "IVILSB" | "SIGNALINK";

/**
 * Static availability of the animation in this repository. "provisional" means
 * a bundled self-authored clip exists but has not been linguistically validated;
 * "unavailable" means no clip is bundled. The viewer derives runtime
 * availability from the configured or uploaded GLB.
 */
export type LsbAnimationStatus = "unavailable" | "provisional";

export interface LsbExpression {
  /** Stable identifier derived from the module, section and list position. */
  id: string;
  /** Label printed by the official source. */
  spanish: string;
  /** Accepted variants; normalization already handles case, accents and punctuation. */
  aliases: readonly string[];
  /** Page where the source illustrates the sign. */
  page: number;
  /**
   * The source prints no written gloss. Kept as an explicit null so consumers
   * cannot mistake the Spanish label for a documented gloss.
   */
  gloss: null;
  /**
   * Animation identifier for the matching sign. It may come from IVILSB or from
   * the project's own provisional clip; the viewer only plays it when the
   * configured GLB actually contains a clip with this identifier.
   */
  animationClipId: string | null;
  animationSource: LsbAnimationSource | null;
  animationStatus: LsbAnimationStatus;
  validation: LsbValidationStatus;
}
