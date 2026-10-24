/** Versioned, framework-independent contract. Execution approval is not linguistic validation. */
export interface SignModelManifest {
  readonly manifestVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly language: string;
  readonly languageCode: string;
  readonly task: string;
  readonly taskKind: "isolated-sign";
  readonly format: string;
  readonly runtime: string;
  readonly adapterId: string;
  readonly executionApproved: boolean;
  readonly validationStatus: "experimental" | "validated";
  readonly modelUrl: string;
  readonly modelBytes: number;
  readonly sha256: string;
  readonly inputName: string;
  readonly inputShape: readonly [1, number, number];
  readonly featureSchema: string;
  readonly preprocessorId: string;
  readonly normalization: string;
  readonly landmarkOrder: readonly string[];
  readonly frameIntervalMs: number;
  readonly outputName: string;
  readonly outputKind: "logits";
  readonly outputClasses: number;
  readonly labels: readonly string[];
  readonly confidenceThreshold: number;
  readonly minimumMargin: number;
  readonly sourceUrl: string;
  readonly license: string;
  readonly limitations: readonly string[];
}
