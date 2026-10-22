import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftResponse } from '../useDraftResponse';
import { DEFAULT_QUICK_PHRASES } from '../quickPhrases.data';
import { SpeechRecognitionDriver } from '../speechDriver';

class MockSpeechDriver implements SpeechRecognitionDriver {
  isSupported = true;
  onResultCallback: ((text: string, isFinal: boolean) => void) | null = null;
  onErrorCallback: ((err: string) => void) | null = null;
  onEndCallback: (() => void) | null = null;
  started = false;

  start(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (err: string) => void,
    onEnd: () => void
  ) {
    this.started = true;
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onEndCallback = onEnd;
  }

  stop() {
    this.started = false;
    this.onEndCallback?.();
  }

  abort() {
    this.started = false;
  }

  // Métodos auxiliares para simular eventos del usuario
  simulateSpeech(text: string, isFinal: boolean) {
    this.onResultCallback?.(text, isFinal);
  }

  simulateError(err: string) {
    this.onErrorCallback?.(err);
  }
}

describe('Feature: Redactar respuesta (useDraftResponse)', () => {
  it('inicializa con el estado por defecto y contador de caracteres correcto', () => {
    const { result } = renderHook(() => useDraftResponse({ maxChars: 500 }));

    expect(result.current.text).toBe('');
    expect(result.current.charCount).toBe(0);
    expect(result.current.maxChars).toBe(500);
    expect(result.current.isDictating).toBe(false);
    expect(result.current.inputMode).toBe('keyboard');
    expect(result.current.quickPhrases.length).toBeGreaterThan(0);
  });

  it('permite escribir texto manualmente y respeta el límite de caracteres (500)', () => {
    const { result } = renderHook(() => useDraftResponse({ maxChars: 10 }));

    act(() => {
      result.current.setText('Hola mundo');
    });

    expect(result.current.text).toBe('Hola mundo');
    expect(result.current.charCount).toBe(10);

    // Intentar exceder el límite
    act(() => {
      result.current.setText('Texto excesivamente largo');
    });

    expect(result.current.text).toBe('Texto exce');
    expect(result.current.charCount).toBe(10);
  });

  it('soporta dictado por voz interactivo con resultados provisionales y finales', () => {
    const mockDriver = new MockSpeechDriver();
    const { result } = renderHook(() => useDraftResponse({}, mockDriver));

    // Iniciar dictado
    act(() => {
      result.current.toggleDictation();
    });

    expect(result.current.isDictating).toBe(true);
    expect(result.current.inputMode).toBe('voice');

    // Simular resultado provisional (hablando)
    act(() => {
      mockDriver.simulateSpeech('Para el registro', false);
    });

    expect(result.current.interimTranscript).toBe('Para el registro');
    expect(result.current.text).toBe('');

    // Simular resultado final consolidado
    act(() => {
      mockDriver.simulateSpeech('Para el registro necesita su carnet.', true);
    });

    expect(result.current.interimTranscript).toBe('');
    expect(result.current.text).toBe('Para el registro necesita su carnet.');

    // Detener dictado
    act(() => {
      result.current.toggleDictation();
    });

    expect(result.current.isDictating).toBe(false);
  });

  it('permite seleccionar una frase frecuente predeterminada', () => {
    const { result } = renderHook(() => useDraftResponse());
    const phrase = DEFAULT_QUICK_PHRASES[0]; // Saludo de bienvenida

    act(() => {
      result.current.selectQuickPhrase(phrase);
    });

    expect(result.current.text).toBe(phrase.text);
    expect(result.current.selectedPhraseId).toBe(phrase.id);
    expect(result.current.inputMode).toBe('quick-phrases');
  });

  it('valida que no se envíe una respuesta vacía', () => {
    const onSend = vi.fn();
    const { result } = renderHook(() => useDraftResponse({ onSendResponse: onSend }));

    act(() => {
      result.current.submitResponse();
    });

    expect(onSend).not.toHaveBeenCalled();
    expect(result.current.error).toBe('No puedes enviar una respuesta vacía.');

    // Rellenar texto y volver a enviar
    act(() => {
      result.current.setText('Horario de atención: 8:00 a 16:00.');
    });

    act(() => {
      result.current.submitResponse();
    });

    expect(onSend).toHaveBeenCalledWith('Horario de atención: 8:00 a 16:00.');
    expect(result.current.error).toBeNull();
  });
});
