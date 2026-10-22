/** Minimal type declarations for the browser's prefixed and unprefixed Web Speech API. */
export interface WebSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface WebSpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface WebSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): WebSpeechRecognitionAlternative;
  [index: number]: WebSpeechRecognitionAlternative;
}

export interface WebSpeechRecognitionResultList {
  readonly length: number;
  item(index: number): WebSpeechRecognitionResult;
  [index: number]: WebSpeechRecognitionResult;
}

export interface WebSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: WebSpeechRecognitionResultList;
}

export interface WebSpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: ((this: WebSpeechRecognitionInstance, event: Event) => void) | null;
  onerror: ((this: WebSpeechRecognitionInstance, event: WebSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: WebSpeechRecognitionInstance, event: WebSpeechRecognitionEvent) => void) | null;
  onstart: ((this: WebSpeechRecognitionInstance, event: Event) => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

export interface WebSpeechRecognitionConstructor {
  new (): WebSpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: WebSpeechRecognitionConstructor;
    webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  }
}
