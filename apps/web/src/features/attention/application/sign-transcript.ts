const SINGLE_CHARACTER_LABEL = /^[A-ZÑ0-9]$/;
const DIGRAPH_LABELS = new Set(["LL"]);

export function isCharacterLabel(label: string): boolean {
  return SINGLE_CHARACTER_LABEL.test(label) || DIGRAPH_LABELS.has(label);
}

export function appendRecognizedLabel(
  current: string,
  label: string,
  previousWasCharacter: boolean,
): string {
  const next = label.trim();
  if (!next) {
    if (!current || current.endsWith(" ")) return current;
    return `${current} `;
  }

  if (!current.trim()) return next;

  if (previousWasCharacter && isCharacterLabel(next) && !current.endsWith(" ")) {
    return `${current}${next}`;
  }

  if (current.endsWith(" ")) return `${current}${next}`;
  return `${current} ${next}`;
}
