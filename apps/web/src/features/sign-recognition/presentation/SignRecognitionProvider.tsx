"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { MediaPipeHolisticLandmarkDetector } from "../infrastructure/mediapipe-holistic-landmark-detector";
import {
  SignRecognitionContext,
  type LandmarkDetectorFactory,
} from "./SignRecognitionContext";

interface SignRecognitionProviderProps {
  children: ReactNode;
  createDetector?: LandmarkDetectorFactory;
}

export function SignRecognitionProvider({
  children,
  createDetector,
}: SignRecognitionProviderProps) {
  const defaultFactory = useCallback(
    () => new MediaPipeHolisticLandmarkDetector(),
    [],
  );
  const factory = useMemo(
    () => createDetector ?? defaultFactory,
    [createDetector, defaultFactory],
  );

  return (
    <SignRecognitionContext.Provider value={factory}>
      {children}
    </SignRecognitionContext.Provider>
  );
}
