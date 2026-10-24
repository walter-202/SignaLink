import type { SignFeatureExtractor } from "../../domain/landmarks";
import type { SignModelManifest } from "../../domain/sign-model";
import type { RecognitionPerformance } from "../recognition-performance";
import type { SignClassifier } from "./sign-classifier";

export interface RecognitionModel {
  readonly manifest: SignModelManifest;
  readonly extractFeatures: SignFeatureExtractor;
  createClassifier(metrics: RecognitionPerformance): Promise<SignClassifier>;
}

export interface RecognitionRuntime {
  listModels(): readonly SignModelManifest[];
  resolveModel(id: string): RecognitionModel;
}
