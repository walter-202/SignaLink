export interface SpeechRecognitionDriver {
  isSupported: boolean;
  start: (onResult: (text: string, isFinal: boolean) => void, onError: (err: string) => void, onEnd: () => void) => void;
  stop: () => void;
  abort: () => void;
}

/**
 * Driver nativo de Web Speech API adaptado para entornos con o sin navegador (SSR-safe).
 */
export class WebSpeechRecognitionDriver implements SpeechRecognitionDriver {
  private recognition: any = null;
  public isSupported: boolean = false;
  private lang: string;

  constructor(lang: string = 'es-BO') {
    this.lang = lang;
    if (typeof window !== 'undefined') {
      const SpeechImpl = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.isSupported = Boolean(SpeechImpl);
      if (this.isSupported) {
        this.recognition = new SpeechImpl();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.lang;
        this.recognition.maxAlternatives = 1;
      }
    }
  }

  start(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (err: string) => void,
    onEnd: () => void
  ): void {
    if (!this.recognition) {
      onError('Speech recognition not supported');
      return;
    }

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript || '';
        onResult(text, item.isFinal);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        onError(event.error || 'speech-error');
      }
    };

    this.recognition.onend = () => {
      onEnd();
    };

    try {
      this.recognition.start();
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        onError(err.message || 'error-starting');
      }
    }
  }

  stop(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }
  }
}
