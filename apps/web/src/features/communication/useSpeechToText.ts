'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SpeechRecognitionErrorEvent,
  SpeechRecognitionEvent,
  SpeechRecognitionInstance,
  SpeechRecognitionStatus,
  UseSpeechToTextOptions,
  UseSpeechToTextReturn,
} from './speech-recognition.types';

/**
 * Hook para reconocimiento de voz en tiempo real usando Web Speech API nativa.
 * Diseñado para la entrada de audio del funcionario en "La Voz de tus Manos".
 */
export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const {
    lang = 'es-BO',
    continuous = true,
    interimResults = true,
    onFinalResult,
    onError,
  } = options;

  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle');
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldKeepListeningRef = useRef<boolean>(false);

  // Comprobar soporte del navegador en montaje
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionImpl =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(Boolean(SpeechRecognitionImpl));
    }
  }, []);

  // Inicializar y configurar la instancia de reconocimiento
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionImpl =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionImpl) return;

    const instance: SpeechRecognitionInstance = new SpeechRecognitionImpl();
    instance.continuous = continuous;
    instance.interimResults = interimResults;
    instance.lang = lang;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      setStatus('listening');
      setError(null);
    };

    instance.onresult = (event: SpeechRecognitionEvent) => {
      let currentInterim = '';
      let accumulatedFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';

        if (result.isFinal) {
          accumulatedFinal += text;
        } else {
          currentInterim += text;
        }
      }

      if (accumulatedFinal) {
        setTranscript((prev) => {
          const next = prev ? `${prev} ${accumulatedFinal.trim()}` : accumulatedFinal.trim();
          onFinalResult?.(next);
          return next;
        });
      }

      setInterimTranscript(currentInterim.trim());
    };

    instance.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ignorar 'no-speech' habitual cuando hay pausas naturales de silencio
      if (event.error === 'no-speech') {
        return;
      }

      setStatus('error');
      const errorMsg = `Error de reconocimiento: ${event.error}`;
      setError(errorMsg);
      onError?.(event);
    };

    instance.onend = () => {
      // Si el modo continuous fue pedido y el usuario no dio stop explícito,
      // reiniciamos automáticamente (algunos navegadores cortan tras breves silencios).
      if (shouldKeepListeningRef.current) {
        try {
          instance.start();
          setStatus('listening');
        } catch {
          setStatus('idle');
          shouldKeepListeningRef.current = false;
        }
      } else {
        setStatus('idle');
        setInterimTranscript('');
      }
    };

    recognitionRef.current = instance;

    return () => {
      shouldKeepListeningRef.current = false;
      try {
        instance.abort();
      } catch {
        // noop en limpieza
      }
      recognitionRef.current = null;
    };
  }, [lang, continuous, interimResults, onFinalResult, onError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Web Speech API no está soportada o no está inicializada.');
      return;
    }

    try {
      shouldKeepListeningRef.current = true;
      setError(null);
      recognitionRef.current.start();
      setStatus('listening');
    } catch (err: unknown) {
      // Si ya estaba en ejecución, no genera fallo crítico
      if (err instanceof DOMException && err.name === 'InvalidStateError') {
        setStatus('listening');
      } else {
        setError('No se pudo acceder al micrófono o iniciar la captura.');
        setStatus('error');
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setStatus('idle');
      } catch {
        // noop
      }
    }
  }, []);

  const abortListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
        setStatus('idle');
      } catch {
        // noop
      }
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    transcript,
    interimTranscript,
    status,
    isListening: status === 'listening',
    isSupported,
    error,
    startListening,
    stopListening,
    abortListening,
    resetTranscript,
  };
}
