export interface QuickPhrase {
  id: string;
  category: 'saludo' | 'requisito' | 'horario' | 'despedida' | 'general';
  label: string;
  text: string;
}

export type InputMode = 'voice' | 'keyboard' | 'quick-phrases';

export interface DraftResponseState {
  text: string;
  charCount: number;
  maxChars: number;
  inputMode: InputMode;
  isDictating: boolean;
  interimTranscript: string;
  selectedPhraseId: string | null;
  error: string | null;
}

export interface UseDraftResponseProps {
  maxChars?: number;
  initialText?: string;
  onSendResponse?: (text: string) => void;
  lang?: string;
}
