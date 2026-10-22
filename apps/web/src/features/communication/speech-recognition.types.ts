/**
 * Declaraciones de tipos para la Web Speech API (W3C Speech API / webkitSpeechRecognition).
 */

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error:
    | 'no-speech'
    | 'aborted'
    | 'audio-capture'
    | 'network'
    | 'not-allowed'
    | 'service-not-allowed'
    | 'bad-grammar'
    | 'language-not-supported';
  readonly message?: string;
}

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onsoundend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type SpeechRecognitionStatus =
  | 'idle'
  | 'listening'
  | 'paused'
  | 'processing'
  | 'error';

export interface UseSpeechToTextOptions {
  /**
   * Código de idioma según BCP 47. Por defecto: 'es-BO' (Español Bolivia) con fallback a 'es-ES'.
   */
  lang?: string;
  /**
   * Si es true, el reconocimiento se mantiene activo y no se detiene al primer silencio largo.
   */
  continuous?: boolean;
  /**
   * Si es true, devuelve resultados intermedios en tiempo real mientras la persona habla.
   */
  interimResults?: boolean;
  /**
   * Callback invocado cada vez que se consolida una frase o texto final.
   */
  onFinalResult?: (transcript: string) => void;
  /**
   * Callback invocado en caso de error.
   */
  onError?: (error: SpeechRecognitionErrorEvent) => void;
}

export interface UseSpeechToTextReturn {
  /** Texto final acumulado */
  transcript: string;
  /** Texto provisional en tiempo real mientras el usuario está pronunciando */
  interimTranscript: string;
  /** Estado actual de la captura */
  status: SpeechRecognitionStatus;
  /** Si el micrófono está escuchando activamente */
  isListening: boolean;
  /** Si el navegador actual soporta Web Speech API */
  isSupported: boolean;
  /** Último error registrado, si hubo alguno */
  error: string | null;
  /** Iniciar escucha */
  startListening: () => void;
  /** Detener escucha */
  stopListening: () => void;
  /** Abortar de inmediato sin procesar audio pendiente */
  abortListening: () => void;
  /** Limpiar la transcripción acumulada */
  resetTranscript: () => void;
}
