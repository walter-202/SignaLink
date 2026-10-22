import { createContext, useContext } from "react";
import type { LandmarkDetector } from "../application/ports/landmark-detector";

export type LandmarkDetectorFactory = () => LandmarkDetector;

export const SignRecognitionContext = createContext<LandmarkDetectorFactory | null>(null);

export function useLandmarkDetectorFactory(): LandmarkDetectorFactory {
  const factory = useContext(SignRecognitionContext);
  if (!factory) {
    throw new Error("SignRecognitionProvider debe envolver la vista de captura.");
  }
  return factory;
}
