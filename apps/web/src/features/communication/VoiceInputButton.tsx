"use client";

import { useSpeechToText } from "./useSpeechToText";

interface VoiceInputButtonProps {
  onTranscriptComplete?: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export function VoiceInputButton({
  onTranscriptComplete,
  placeholder = "Presiona el micrófono y habla…",
  className = "",
}: VoiceInputButtonProps) {
  const {
    transcript,
    interimTranscript,
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

  if (!isSupported) {
    return (
      <p className={`voice-support-message ${className}`} role="status">
        El dictado no está disponible en este navegador. Puedes escribir en el
        campo de texto.
      </p>
    );
  }

  return (
    <div className={`voice-input ${className}`}>
      <div className="voice-actions">
        <button
          className={isListening ? "voice-button is-listening" : "voice-button"}
          type="button"
          onClick={isListening ? stopListening : startListening}
          aria-label={isListening ? "Detener dictado" : "Iniciar dictado"}
          aria-pressed={isListening}
        >
          <span aria-hidden="true">{isListening ? "■" : "🎙"}</span>
          {isListening ? "Detener dictado" : "Dictar"}
        </button>
        {transcript ? (
          <button
            className="voice-clear-button"
            type="button"
            onClick={() => {
              resetTranscript();
              onTranscriptComplete?.("");
            }}
          >
            Limpiar
          </button>
        ) : null}
        <span className="voice-state" aria-live="polite">
          {isListening ? "Escuchando" : ""}
        </span>
      </div>

      <p className="voice-transcript" aria-live="polite" aria-atomic="true">
        {transcript ? (
          <>
            {transcript}{" "}
            {interimTranscript ? <span className="voice-interim">{interimTranscript}</span> : null}
          </>
        ) : interimTranscript ? (
          <span className="voice-interim">{interimTranscript}</span>
        ) : (
          <span className="voice-placeholder">{placeholder}</span>
        )}
      </p>

      {error ? <p className="voice-error" role="alert">{error}</p> : null}
    </div>
  );
}
