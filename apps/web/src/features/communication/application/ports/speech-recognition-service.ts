export type SpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "bad-grammar"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "service-not-allowed"
  | "unknown";

export interface SpeechRecognitionUpdate {
  finalTranscript: string;
  interimTranscript: string;
}

export interface SpeechRecognitionSessionOptions {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onStart: () => void;
  onResult: (update: SpeechRecognitionUpdate) => void;
  onError: (code: SpeechRecognitionErrorCode) => void;
  onEnd: () => void;
}

export interface SpeechRecognitionSession {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/** Port for browser, local-model, or remote speech-to-text adapters. */
export interface SpeechRecognitionService {
  isSupported: () => boolean;
  createSession: (options: SpeechRecognitionSessionOptions) => SpeechRecognitionSession | null;
}
