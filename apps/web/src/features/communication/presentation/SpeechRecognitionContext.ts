import { createContext, useContext } from "react";
import type { SpeechRecognitionService } from "../application/ports/speech-recognition-service";

export const SpeechRecognitionContext = createContext<SpeechRecognitionService | null>(null);

export function useSpeechRecognitionService(): SpeechRecognitionService {
  const service = useContext(SpeechRecognitionContext);
  if (!service) {
    throw new Error("SpeechRecognitionProvider debe envolver la interfaz de comunicación.");
  }
  return service;
}
