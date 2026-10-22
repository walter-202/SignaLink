"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  SpeechRecognitionErrorCode,
  SpeechRecognitionSession,
} from "../../application/ports/speech-recognition-service";
import { useSpeechRecognitionService } from "../SpeechRecognitionContext";

export type SpeechRecognitionStatus = "idle" | "listening" | "processing" | "error";

export interface UseSpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onFinalResult?: (transcript: string) => void;
  onError?: (code: SpeechRecognitionErrorCode) => void;
}

export interface UseSpeechToTextReturn {
  transcript: string;
  interimTranscript: string;
  status: SpeechRecognitionStatus;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  abortListening: () => void;
  resetTranscript: () => void;
}

const subscribeToSupport = () => () => undefined;
const getServerSupportSnapshot = () => false;

function getRecognitionErrorMessage(code: SpeechRecognitionErrorCode): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "No se autorizó el micrófono. Habilita el permiso del sitio o escribe la respuesta.";
    case "audio-capture":
      return "No se encontró un micrófono disponible. Puedes escribir la respuesta.";
    case "language-not-supported":
      return "Este navegador no admite español de Bolivia para dictado. Puedes escribir la respuesta.";
    case "network":
      return "El servicio de dictado del navegador no respondió. Puedes escribir la respuesta.";
    case "no-speech":
      return "No se detectó voz. Intenta de nuevo o escribe la respuesta.";
    case "aborted":
      return "";
    case "bad-grammar":
    case "unknown":
      return "No se pudo completar el dictado. Puedes escribir la respuesta.";
  }
}

function getStartErrorMessage(error: unknown): string {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "No se autorizó el micrófono. Habilita el permiso del sitio o escribe la respuesta.";
  }
  return "No se pudo iniciar el dictado. Puedes escribir la respuesta.";
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const {
    lang = "es-BO",
    continuous = true,
    interimResults = true,
    onFinalResult,
    onError,
  } = options;
  const service = useSpeechRecognitionService();
  const getSupportSnapshot = useCallback(() => service.isSupported(), [service]);
  const isSupported = useSyncExternalStore(
    subscribeToSupport,
    getSupportSnapshot,
    getServerSupportSnapshot,
  );

  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  const callbacksRef = useRef({ onFinalResult, onError });
  const transcriptRef = useRef("");
  const shouldKeepListeningRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    callbacksRef.current = { onFinalResult, onError };
  }, [onFinalResult, onError]);

  useEffect(() => {
    mountedRef.current = true;
    const session = service.createSession({
      lang,
      continuous,
      interimResults,
      onStart: () => {
        if (!mountedRef.current) return;
        setStatus("listening");
        setError(null);
      },
      onResult: ({ finalTranscript, interimTranscript: nextInterimTranscript }) => {
        if (!mountedRef.current) return;
        if (finalTranscript) {
          const nextTranscript = [transcriptRef.current, finalTranscript].filter(Boolean).join(" ");
          transcriptRef.current = nextTranscript;
          setTranscript(nextTranscript);
          callbacksRef.current.onFinalResult?.(nextTranscript);
        }
        setInterimTranscript(nextInterimTranscript);
      },
      onError: (code) => {
        if (!mountedRef.current || code === "aborted") return;
        shouldKeepListeningRef.current = false;
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
        setStatus("error");
        setInterimTranscript("");
        const message = getRecognitionErrorMessage(code);
        setError(message);
        callbacksRef.current.onError?.(code);
      },
      onEnd: () => {
        if (!mountedRef.current) return;
        if (continuous && shouldKeepListeningRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          setStatus("processing");
          restartTimerRef.current = setTimeout(() => {
            restartTimerRef.current = null;
            const activeSession = sessionRef.current;
            if (!shouldKeepListeningRef.current || !activeSession) return;
            try {
              activeSession.start();
            } catch {
              shouldKeepListeningRef.current = false;
              setStatus("error");
              setError("El navegador detuvo el dictado. Puedes volver a intentarlo o escribir la respuesta.");
            }
          }, 200);
          return;
        }
        setStatus((current) => current === "error" ? "error" : "idle");
        setInterimTranscript("");
      },
    });
    sessionRef.current = session;

    return () => {
      mountedRef.current = false;
      shouldKeepListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
      try {
        session?.abort();
      } catch {
        // The browser may already have ended the session.
      }
      sessionRef.current = null;
    };
  }, [service, lang, continuous, interimResults]);

  const startListening = useCallback(() => {
    const session = sessionRef.current;
    if (!isSupported || !session) {
      setStatus("error");
      setError("El dictado no está disponible en este navegador. Puedes escribir la respuesta.");
      return;
    }

    try {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
      shouldKeepListeningRef.current = true;
      setError(null);
      setStatus("listening");
      session.start();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "InvalidStateError") {
        setStatus("listening");
        return;
      }
      shouldKeepListeningRef.current = false;
      setStatus("error");
      setError(getStartErrorMessage(cause));
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    const session = sessionRef.current;
    if (!session) {
      setStatus("idle");
      return;
    }
    setStatus("processing");
    try {
      session.stop();
    } catch {
      setStatus("idle");
      setInterimTranscript("");
    }
  }, []);

  const abortListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    try {
      sessionRef.current?.abort();
    } catch {
      // The browser may already have ended the session.
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
