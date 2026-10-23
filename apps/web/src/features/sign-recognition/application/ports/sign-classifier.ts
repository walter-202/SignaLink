export interface SignClassification {
  label: string;
  classIndex: number;
  confidence: number;
}

export interface SignClassifier {
  initialize(onStage?: (message: string) => void): Promise<void>;
  classify(sequence: readonly Float32Array[]): Promise<SignClassification>;
  close(): void;
}
