export interface PairedComparison {
  baseline: { runId: string };
  candidate: { runId: string };
  [key: string]: unknown;
}
export function compareRuns(corpusInput: unknown, baselineInput: unknown, candidateInput: unknown): PairedComparison;
