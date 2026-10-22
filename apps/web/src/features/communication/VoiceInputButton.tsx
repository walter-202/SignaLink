'use client';

import React from 'react';
import { useSpeechToText } from './useSpeechToText';

interface VoiceInputProps {
  onTranscriptComplete?: (text: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Componente UI accesible para el dictado por voz del funcionario
 * en la atención al público (Español -> LSB).
 */
export const VoiceInputButton: React.FC<VoiceInputProps> = ({
  onTranscriptComplete,
  placeholder = 'Presiona el micrófono y habla...',
  className = '',
}) => {
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
    lang: 'es-BO',
    continuous: true,
    interimResults: true,
    onFinalResult: (finalText) => {
      onTranscriptComplete?.(finalText);
    },
  });

  if (!isSupported) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
        El dictado por voz nativo no está disponible en este navegador. Por favor utiliza Chrome, Edge o escribe manualmente.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 w-full max-w-lg ${className}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all shadow-sm ${
            isListening
              ? 'bg-red-600 text-white animate-pulse hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          aria-label={isListening ? 'Detener micrófono' : 'Iniciar micrófono'}
        >
          <span className="text-lg">{isListening ? '⏹️' : '🎙️'}</span>
          <span>{isListening ? 'Escuchando...' : 'Hablar'}</span>
        </button>

        {transcript && (
          <button
            type="button"
            onClick={resetTranscript}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Visualización del texto en tiempo real */}
      <div className="min-h-16 p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
        {transcript ? (
          <p className="text-gray-900 font-medium">
            {transcript}{' '}
            {interimTranscript && (
              <span className="text-gray-400 italic">{interimTranscript}</span>
            )}
          </p>
        ) : interimTranscript ? (
          <p className="text-gray-400 italic">{interimTranscript}</p>
        ) : (
          <p className="text-gray-400 italic">{placeholder}</p>
        )}
      </div>

      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
    </div>
  );
};
