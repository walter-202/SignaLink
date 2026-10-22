"use client";

import { useMemo, type ReactNode } from "react";
import { browserSpeechRecognitionService } from "../infrastructure/browser-speech-recognition-service";
import type { SpeechRecognitionService } from "../application/ports/speech-recognition-service";
import { SpeechRecognitionContext } from "./SpeechRecognitionContext";

interface SpeechRecognitionProviderProps {
  children: ReactNode;
  service?: SpeechRecognitionService;
}

export function SpeechRecognitionProvider({ children, service }: SpeechRecognitionProviderProps) {
  const resolvedService = useMemo(
    () => service ?? browserSpeechRecognitionService,
    [service],
  );

  return (
    <SpeechRecognitionContext.Provider value={resolvedService}>
      {children}
    </SpeechRecognitionContext.Provider>
  );
}
