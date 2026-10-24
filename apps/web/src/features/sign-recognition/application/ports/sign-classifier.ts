export interface SignClassification {
  modelId: string;
  modelVersion: string;
  /** Softmax score and top-1/top-2 margin; neither is a calibrated accuracy estimate. */
  margin: number;
  decision: "candidate" | "uncertain";
  label: string;
  classIndex: number;
  confidence: number;
}

export interface SignClassifier {
  initialize(onStage?: (message: string) => void): Promise<void>;
  classify(sequence: readonly Float32Array[]): Promise<SignClassification>;
  close(): void;
}
