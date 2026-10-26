export interface RunnerCorpus {
  datasetId: string;
  evidence: "synthetic" | "recorded";
  labels: Array<{ id: string }>;
  clips: Array<{ id: string; split: "train" | "validation" | "test"; durationMs: number; kind: "sign" | "rest" | "non-sign"; onsetMs: number | null; endMs: number | null; labelId: string | null }>;
}
export interface RunnerConfig {
  deviceProfileId: string;
  browserProfileId: string;
  modelLabelMap: Record<string, string>;
  runs: Array<{ runId: string; landmarkRuntime: "main-thread" | "worker"; condition: "warm" }>;
}
export interface RunnerInputs {
  config: RunnerConfig;
  corpus: RunnerCorpus;
  corpusSha256: string;
  clips: Map<string, { path: string; contentType: string; bytes: number; durationMs: number }>;
  holistic: { url: string; version: string; sha256: string; bytes: number };
  codeRevision: string;
  runIds: string[];
  repoRoot: string;
}
export function validateRunnerConfig(config: unknown, corpus: unknown): string[];
export function assertPrivateRunOutputsAvailable(repoRoot: string, runIds: string[]): Promise<void>;
export function loadRunnerInputs(configPath: string, repoRoot: string): Promise<RunnerInputs>;
export function writePrivateRun(repoRoot: string, runId: string, run: unknown): Promise<void>;
export function writePrivateComparison(repoRoot: string, baselineRunId: string, candidateRunId: string, comparison: unknown): Promise<string>;
