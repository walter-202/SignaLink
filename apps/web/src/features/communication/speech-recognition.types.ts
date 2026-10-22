/** Tipos mínimos para la Web Speech API y su implementación prefijada en WebKit. */

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error:
    | "no-speech"
    | "aborted"
    | "audio-capture"
    | "network"
    | "not-allowed"
    | "service-not-allowed"
    | "bad-grammar"
    | "language-not-supported";
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
  onend: ((this: SpeechRecognitionInstance, event: Event) => void) | null;
  onerror:
    | ((this: SpeechRecognitionInstance, event: SpeechRecognitionErrorEvent) => void)
    | null;
  onresult:
    | ((this: SpeechRecognitionInstance, event: SpeechRecognitionEvent) => void)
    | null;
  onstart: ((this: SpeechRecognitionInstance, event: Event) => void) | null;
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

export type SpeechRecognitionStatus = "idle" | "listening" | "processing" | "error";

export interface UseSpeechToTextOptions {
  /** Etiqueta BCP 47; por defecto, español de Bolivia. */
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  /** Recibe la transcripción final acumulada. */
  onFinalResult?: (transcript: string) => void;
  onError?: (error: SpeechRecognitionErrorEvent) => void;
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
