"use client";

import { useEffect, useId } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSpeechToText } from "../hooks/useSpeechToText";

interface VoiceInputButtonProps {
  onTranscriptComplete?: (text: string) => void;
  onStart?: () => void;
  onListeningChange?: (listening: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInputButton({
  onTranscriptComplete,
  onStart,
  onListeningChange,
  disabled = false,
  className = "",
}: VoiceInputButtonProps) {
  const statusId = useId();
  const {
    transcript,
    interimTranscript,
    status,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechToText({
    lang: "es-BO",
    continuous: true,
    interimResults: true,
    onFinalResult: onTranscriptComplete,
  });
  const isProcessing = status === "processing";

  useEffect(() => {
    onListeningChange?.(isListening || isProcessing);
  }, [isListening, isProcessing, onListeningChange]);

  useEffect(() => {
    if (disabled && (isListening || isProcessing)) stopListening();
  }, [disabled, isListening, isProcessing, stopListening]);

  function toggleListening() {
    if (isListening) {
      stopListening();
      return;
    }
    if (!isSupported || isProcessing) return;
    resetTranscript();
    onStart?.();
    startListening();
  }

  const statusMessage = !isSupported
    ? "El dictado no está disponible en este navegador. Puedes escribir la respuesta."
    : isListening
      ? interimTranscript ? `Escuchando: ${interimTranscript}` : "Escuchando. Habla cerca del micrófono."
      : isProcessing
        ? "Procesando la transcripción…"
        : transcript
          ? "Transcripción agregada al borrador; revísala antes de enviarla."
          : "Dictado del navegador; su proveedor puede procesar el audio. Revisa antes de enviar.";

  return (
    <div className={`voice-input ${className}`.trim()}>
      <Button
        size="small"
        variant="secondary"
        onClick={toggleListening}
        disabled={disabled || !isSupported || isProcessing}
        aria-pressed={isListening}
        aria-label={isListening ? "Detener dictado" : "Iniciar dictado"}
        aria-describedby={statusId}
        title={isListening ? "Detener dictado" : "Dictar una respuesta"}
      >
        {isListening ? <Square size={14} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
        {isListening ? "Detener" : isProcessing ? "Procesando…" : "Dictar"}
      </Button>
      {error ? (
        <span className="voice-input-error" id={statusId} role="alert">{error}</span>
      ) : (
        <span className="voice-input-status" id={statusId} role={isListening || isProcessing || transcript || !isSupported ? "status" : undefined} aria-live="polite">
          {statusMessage}
        </span>
      )}
    </div>
  );
}
