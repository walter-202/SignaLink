"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createBrowserRecognitionRuntime } from "../infrastructure/browser-recognition-runtime";
import type { RecognitionRuntime } from "../application/ports/recognition-runtime";
import { MediaPipeHolisticLandmarkDetector } from "../infrastructure/mediapipe-holistic-landmark-detector";
import {
  SignRecognitionContext,
  RecognitionModelContext,
  type LandmarkDetectorFactory,
} from "./SignRecognitionContext";

interface SignRecognitionProviderProps {
  children: ReactNode;
  createDetector?: LandmarkDetectorFactory;
  runtime?: RecognitionRuntime;
  initialModelId?: string;
}

export function SignRecognitionProvider({
  children,
  createDetector,
  runtime: suppliedRuntime,
  initialModelId,
}: SignRecognitionProviderProps) {
  const runtime = useMemo(() => suppliedRuntime ?? createBrowserRecognitionRuntime(), [suppliedRuntime]);
  const models = useMemo(() => runtime.listModels(), [runtime]);
  const [modelId, setModelId] = useState(() => initialModelId ?? models[0]?.id ?? "");
  const model = useMemo(() => runtime.resolveModel(modelId), [runtime, modelId]);
  const selectModel = useCallback((id: string) => {
    runtime.resolveModel(id); // Fail closed before changing selection or starting a download.
    setModelId(id);
  }, [runtime]);
  const selection = useMemo(() => ({ model, models, selectModel }), [model, models, selectModel]);
  const defaultFactory = useCallback(
    () => new MediaPipeHolisticLandmarkDetector(),
    [],
  );
  const factory = useMemo(
    () => createDetector ?? defaultFactory,
    [createDetector, defaultFactory],
  );

  return (
    <RecognitionModelContext.Provider value={selection}>
      <SignRecognitionContext.Provider value={factory}>
        {children}
      </SignRecognitionContext.Provider>
    </RecognitionModelContext.Provider>
  );
}
