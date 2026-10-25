import { createContext, useContext } from "react";
import type { LandmarkDetector } from "../application/ports/landmark-detector";

export type LandmarkDetectorFactory = () => LandmarkDetector;

export const SignRecognitionContext = createContext<LandmarkDetectorFactory | null>(null);

export type LandmarkRuntimeMode = "main-thread" | "worker";
export interface LandmarkRuntimeSelection {
  mode: LandmarkRuntimeMode;
  selectable: boolean;
  selectMode: (mode: LandmarkRuntimeMode) => void;
}
export const LandmarkRuntimeContext = createContext<LandmarkRuntimeSelection | null>(null);

export function useLandmarkRuntime(): LandmarkRuntimeSelection {
  const selection = useContext(LandmarkRuntimeContext);
  if (!selection) throw new Error("SignRecognitionProvider debe envolver la vista de captura.");
  return selection;
}

export function useLandmarkDetectorFactory(): LandmarkDetectorFactory {
  const factory = useContext(SignRecognitionContext);
  if (!factory) {
    throw new Error("SignRecognitionProvider debe envolver la vista de captura.");
  }
  return factory;
}

export interface RecognitionModelSelection {
  model: import("../application/ports/recognition-runtime").RecognitionModel;
  models: readonly import("../domain/sign-model").SignModelManifest[];
  selectModel: (id: string) => void;
}

export const RecognitionModelContext = createContext<RecognitionModelSelection | null>(null);

export function useRecognitionModel(): RecognitionModelSelection {
  const selection = useContext(RecognitionModelContext);
  if (!selection) throw new Error("SignRecognitionProvider debe envolver la vista de captura.");
  return selection;
}
