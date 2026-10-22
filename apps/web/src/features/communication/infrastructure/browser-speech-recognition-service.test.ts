import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  WebSpeechRecognitionErrorEvent,
  WebSpeechRecognitionEvent,
  WebSpeechRecognitionInstance,
  WebSpeechRecognitionResultList,
} from "./web-speech-api.types";
import { BrowserSpeechRecognitionService } from "./browser-speech-recognition-service";

class FakeSpeechRecognition extends EventTarget implements WebSpeechRecognitionInstance {
  static instance: FakeSpeechRecognition;
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 0;
  onend: WebSpeechRecognitionInstance["onend"] = null;
  onerror: WebSpeechRecognitionInstance["onerror"] = null;
  onresult: WebSpeechRecognitionInstance["onresult"] = null;
  onstart: WebSpeechRecognitionInstance["onstart"] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    super();
    FakeSpeechRecognition.instance = this;
  }
}

const originalSpeechRecognition = window.SpeechRecognition;
const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;

afterEach(() => {
  if (originalSpeechRecognition) {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: originalSpeechRecognition });
  } else {
    Reflect.deleteProperty(window, "SpeechRecognition");
  }
  if (originalWebkitSpeechRecognition) {
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: originalWebkitSpeechRecognition });
  } else {
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  }
});

describe("BrowserSpeechRecognitionService", () => {
  it("configures the browser adapter and emits final/interim transcript updates", () => {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: FakeSpeechRecognition });
    const service = new BrowserSpeechRecognitionService();
    const onResult = vi.fn();
    const session = service.createSession({
      lang: "es-BO",
      continuous: true,
      interimResults: true,
      onStart: vi.fn(),
      onResult,
      onError: vi.fn(),
      onEnd: vi.fn(),
    });

    expect(service.isSupported()).toBe(true);
    expect(session).not.toBeNull();
    expect(FakeSpeechRecognition.instance.lang).toBe("es-BO");
    expect(FakeSpeechRecognition.instance.continuous).toBe(true);
    expect(FakeSpeechRecognition.instance.interimResults).toBe(true);

    FakeSpeechRecognition.instance.onresult?.({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: "  Necesito ayuda  ", confidence: 1 } },
        { isFinal: false, 0: { transcript: " con mi trámite", confidence: 0.5 } },
      ] as unknown as WebSpeechRecognitionResultList,
    } as WebSpeechRecognitionEvent);

    expect(onResult).toHaveBeenCalledWith({
      finalTranscript: "Necesito ayuda",
      interimTranscript: "con mi trámite",
    });
  });

  it("normalizes browser errors to the application service contract", () => {
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: FakeSpeechRecognition });
    const onError = vi.fn();
    const service = new BrowserSpeechRecognitionService();
    service.createSession({
      lang: "es-BO",
      continuous: true,
      interimResults: true,
      onStart: vi.fn(),
      onResult: vi.fn(),
      onError,
      onEnd: vi.fn(),
    });

    FakeSpeechRecognition.instance.onerror?.({ error: "not-allowed" } as WebSpeechRecognitionErrorEvent);
    FakeSpeechRecognition.instance.onerror?.({ error: "vendor-specific-error" } as WebSpeechRecognitionErrorEvent);

    expect(onError).toHaveBeenNthCalledWith(1, "not-allowed");
    expect(onError).toHaveBeenNthCalledWith(2, "unknown");
  });
});
