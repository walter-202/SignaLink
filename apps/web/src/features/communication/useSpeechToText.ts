"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  SpeechRecognitionErrorEvent,
  SpeechRecognitionEvent,
  SpeechRecognitionInstance,
  SpeechRecognitionStatus,
  UseSpeechToTextOptions,
  UseSpeechToTextReturn,
} from "./speech-recognition.types";

const subscribeToSupport = () => () => {};
const getSupportSnapshot = () =>
  typeof window !== "undefined" &&
  Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
const getServerSupportSnapshot = () => false;

export function useSpeechToText(
  options: UseSpeechToTextOptions = {},
): UseSpeechToTextReturn {
  const {
    lang = "es-BO",
    continuous = true,
    interimResults = true,
    onFinalResult,
    onError,
  } = options;
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const isSupported = useSyncExternalStore(
    subscribeToSupport,
    getSupportSnapshot,
    getServerSupportSnapshot,
  );
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");
  const shouldKeepListeningRef = useRef(false);
  const callbacksRef = useRef({ onFinalResult, onError });

  useEffect(() => {
    callbacksRef.current = { onFinalResult, onError };
  }, [onFinalResult, onError]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus("listening");
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = "";
      let currentInterim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += text;
        else currentInterim += text;
      }

      if (finalChunk.trim()) {
        const nextTranscript = [transcriptRef.current, finalChunk.trim()]
          .filter(Boolean)
          .join(" ");
        transcriptRef.current = nextTranscript;
        setTranscript(nextTranscript);
        callbacksRef.current.onFinalResult?.(nextTranscript);
      }

      setInterimTranscript(currentInterim.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;

      shouldKeepListeningRef.current = false;
      setStatus("error");
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "El navegador no permitió usar el micrófono. Revisa los permisos del sitio."
        : `Error de reconocimiento: ${event.error}`;
      setError(message);
      callbacksRef.current.onError?.(event);
    };

    recognition.onend = () => {
      if (continuous && shouldKeepListeningRef.current) {
        // Algunos navegadores cierran la sesión tras una pausa; reiniciarla
        // con un pequeño retraso evita llamar start() durante el cierre.
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (!shouldKeepListeningRef.current) return;
          try {
            recognition.start();
          } catch {
            shouldKeepListeningRef.current = false;
            setStatus("idle");
          }
        }, 200);
        return;
      }

      setStatus("idle");
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    return () => {
      shouldKeepListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
      try {
        recognition.abort();
      } catch {
        // Puede no haber una sesión activa al desmontar.
      }
      recognitionRef.current = null;
    };
  }, [continuous, interimResults, lang]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError("El reconocimiento de voz no está disponible en este navegador.");
      return;
    }

    try {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
      shouldKeepListeningRef.current = true;
      setError(null);
      recognition.start();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "InvalidStateError") {
        setStatus("listening");
        return;
      }
      shouldKeepListeningRef.current = false;
      setStatus("error");
      setError("No se pudo iniciar la captura. Revisa los permisos del micrófono.");
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    if (!recognitionRef.current) return;
    setStatus("processing");
    try {
      recognitionRef.current.stop();
    } catch {
      setStatus("idle");
    }
  }, []);

  const abortListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    try {
      recognitionRef.current?.abort();
    } catch {
      // No había una sesión activa.
    }
    setStatus("idle");
    setInterimTranscript("");
  }, []);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    transcript,
    interimTranscript,
    status,
    isListening: status === "listening",
    isSupported,
    error,
    startListening,
    stopListening,
    abortListening,
    resetTranscript,
  };
}
