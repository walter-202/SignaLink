"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createBrowserRecognitionRuntime } from "../infrastructure/browser-recognition-runtime";
import type { RecognitionRuntime } from "../application/ports/recognition-runtime";
import { BrowserLandmarkDetector } from "../infrastructure/browser-landmark-detector";
import {
  SignRecognitionContext,
  RecognitionModelContext,
  LandmarkRuntimeContext,
  type LandmarkRuntimeMode,
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
  const [landmarkMode, setLandmarkMode] = useState<LandmarkRuntimeMode>(
    () => process.env.NEXT_PUBLIC_MEDIAPIPE_WORKER === "on" ? "worker" : "main-thread",
  );
  const selectLandmarkMode = useCallback((mode: LandmarkRuntimeMode) => {
    if (createDetector) throw new Error("El detector inyectado controla su propio motor.");
    if (mode !== "main-thread" && mode !== "worker") throw new Error("Motor de landmarks desconocido.");
    setLandmarkMode(mode);
  }, [createDetector]);
  const landmarkSelection = useMemo(() => ({ mode: landmarkMode, selectable: !createDetector, selectMode: selectLandmarkMode }), [landmarkMode, createDetector, selectLandmarkMode]);
  const defaultFactory = useCallback(
    () => new BrowserLandmarkDetector({ preferWorker: landmarkMode === "worker" }),
    [landmarkMode],
  );
  const factory = useMemo(
    () => createDetector ?? defaultFactory,
    [createDetector, defaultFactory],
  );

  return (
    <RecognitionModelContext.Provider value={selection}>
      <LandmarkRuntimeContext.Provider value={landmarkSelection}>
        <SignRecognitionContext.Provider value={factory}>
          {children}
        </SignRecognitionContext.Provider>
      </LandmarkRuntimeContext.Provider>
    </RecognitionModelContext.Provider>
  );
}
