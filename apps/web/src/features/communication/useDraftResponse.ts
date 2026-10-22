'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DraftResponseState, InputMode, QuickPhrase, UseDraftResponseProps } from './draft-response.types';
import { DEFAULT_QUICK_PHRASES } from './quickPhrases.data';
import { SpeechRecognitionDriver, WebSpeechRecognitionDriver } from './speechDriver';

export interface UseDraftResponseReturn extends DraftResponseState {
  // Acciones
  setText: (text: string) => void;
  appendChunk: (chunk: string) => void;
  clearText: () => void;
  setInputMode: (mode: InputMode) => void;
  toggleDictation: () => void;
  selectQuickPhrase: (phrase: QuickPhrase) => void;
  submitResponse: () => void;
  isSupported: boolean;
  quickPhrases: QuickPhrase[];
}

export function useDraftResponse(
  props: UseDraftResponseProps = {},
  driverOverride?: SpeechRecognitionDriver
): UseDraftResponseReturn {
  const {
    maxChars = 500,
    initialText = '',
    onSendResponse,
    lang = 'es-BO',
  } = props;

  const [text, setTextState] = useState<string>(initialText.slice(0, maxChars));
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [inputMode, setInputMode] = useState<InputMode>('keyboard');
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const driverRef = useRef<SpeechRecognitionDriver | null>(null);

  useEffect(() => {
    driverRef.current = driverOverride || new WebSpeechRecognitionDriver(lang);
  }, [driverOverride, lang]);

  const setText = useCallback((newText: string) => {
    if (newText.length <= maxChars) {
      setTextState(newText);
    } else {
      setTextState(newText.slice(0, maxChars));
    }
  }, [maxChars]);

  const appendChunk = useCallback((chunk: string) => {
    setTextState((prev) => {
      const trimmed = chunk.trim();
      if (!trimmed) return prev;
      const combined = prev ? `${prev} ${trimmed}` : trimmed;
      return combined.slice(0, maxChars);
    });
  }, [maxChars]);

  const clearText = useCallback(() => {
    setTextState('');
    setInterimTranscript('');
    setSelectedPhraseId(null);
    setError(null);
  }, []);

  const toggleDictation = useCallback(() => {
    const driver = driverRef.current;
    if (!driver || !driver.isSupported) {
      setError('El reconocimiento por voz no está disponible en este entorno.');
      return;
    }

    if (isDictating) {
      driver.stop();
      setIsDictating(false);
      setInterimTranscript('');
    } else {
      setError(null);
      setInputMode('voice');
      setIsDictating(true);

      driver.start(
        (recognizedText: string, isFinal: boolean) => {
          if (isFinal) {
            appendChunk(recognizedText);
            setInterimTranscript('');
          } else {
            setInterimTranscript(recognizedText);
          }
        },
        (err: string) => {
          setError(`Error de voz: ${err}`);
          setIsDictating(false);
        },
        () => {
          setIsDictating(false);
        }
      );
    }
  }, [isDictating, appendChunk]);

  const selectQuickPhrase = useCallback((phrase: QuickPhrase) => {
    setSelectedPhraseId(phrase.id);
    setText(phrase.text);
    setInputMode('quick-phrases');
    if (isDictating && driverRef.current) {
      driverRef.current.stop();
      setIsDictating(false);
      setInterimTranscript('');
    }
  }, [setText, isDictating]);

  const submitResponse = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('No puedes enviar una respuesta vacía.');
      return;
    }

    if (isDictating && driverRef.current) {
      driverRef.current.stop();
      setIsDictating(false);
    }

    onSendResponse?.(trimmed);
  }, [text, isDictating, onSendResponse]);

  return {
    text,
    charCount: text.length,
    maxChars,
    inputMode,
    isDictating,
    interimTranscript,
    selectedPhraseId,
    error,
    setText,
    appendChunk,
    clearText,
    setInputMode,
    toggleDictation,
    selectQuickPhrase,
    submitResponse,
    isSupported: driverRef.current ? driverRef.current.isSupported : false,
    quickPhrases: DEFAULT_QUICK_PHRASES,
  };
}

