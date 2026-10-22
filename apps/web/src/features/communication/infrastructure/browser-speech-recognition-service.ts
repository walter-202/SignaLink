import type {
  SpeechRecognitionErrorCode,
  SpeechRecognitionService,
  SpeechRecognitionSession,
  SpeechRecognitionSessionOptions,
} from "../application/ports/speech-recognition-service";
import type {
  WebSpeechRecognitionErrorEvent,
  WebSpeechRecognitionEvent,
} from "./web-speech-api.types";

const knownErrors = new Set<SpeechRecognitionErrorCode>([
  "aborted",
  "audio-capture",
  "bad-grammar",
  "language-not-supported",
  "network",
  "no-speech",
  "not-allowed",
  "service-not-allowed",
]);

function mapErrorCode(event: WebSpeechRecognitionErrorEvent): SpeechRecognitionErrorCode {
  return knownErrors.has(event.error as SpeechRecognitionErrorCode)
    ? event.error as SpeechRecognitionErrorCode
    : "unknown";
}

export class BrowserSpeechRecognitionService implements SpeechRecognitionService {
  isSupported = (): boolean => typeof window !== "undefined"
    && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  createSession(options: SpeechRecognitionSessionOptions): SpeechRecognitionSession | null {
    if (typeof window === "undefined") return null;

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return null;

    const recognition = new Recognition();
    recognition.continuous = options.continuous;
    recognition.interimResults = options.interimResults;
    recognition.lang = options.lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = options.onStart;
    recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalTranscript += text;
        else interimTranscript += text;
      }

      options.onResult({
        finalTranscript: finalTranscript.trim(),
        interimTranscript: interimTranscript.trim(),
      });
    };
    recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
      options.onError(mapErrorCode(event));
    };
    recognition.onend = options.onEnd;

    return {
      start: () => recognition.start(),
      stop: () => recognition.stop(),
      abort: () => recognition.abort(),
    };
  }
}

export const browserSpeechRecognitionService = new BrowserSpeechRecognitionService();
