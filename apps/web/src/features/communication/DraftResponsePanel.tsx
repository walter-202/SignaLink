'use client';

import React, { useRef, useState } from 'react';
import { useDraftResponse } from './useDraftResponse';
import { QuickPhrase } from './draft-response.types';

export interface DraftResponsePanelProps {
  onSendResponse?: (response: string) => void;
  maxChars?: number;
  initialText?: string;
  className?: string;
}

/**
 * Panel "Redactar respuesta" de la interfaz de escritorio de atención a trámites.
 * Soporta dictado por voz continuo, tipeo manual y selección de frases frecuentes validadas en LSB.
 */
export const DraftResponsePanel: React.FC<DraftResponsePanelProps> = ({
  onSendResponse,
  maxChars = 500,
  initialText = '',
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showQuickModal, setShowQuickModal] = useState<boolean>(false);

  const {
    text,
    charCount,
    inputMode,
    isDictating,
    interimTranscript,
    error,
    setText,
    clearText,
    setInputMode,
    toggleDictation,
    selectQuickPhrase,
    submitResponse,
    quickPhrases,
  } = useDraftResponse({
    maxChars,
    initialText,
    onSendResponse,
  });

  const handleUseKeyboard = () => {
    setInputMode('keyboard');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSelectPhrase = (phrase: QuickPhrase) => {
    selectQuickPhrase(phrase);
    setShowQuickModal(false);
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col gap-3.5 transition-all ${className}`}
      data-testid="draft-response-panel"
    >
      {/* Encabezado del módulo */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className="text-teal-700 text-lg">✏️</span>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">Redactar respuesta</h2>
        </div>
        <button
          type="button"
          title="Información de redacción y voz"
          aria-label="Ayuda sobre redactar respuesta"
          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xs font-semibold"
        >
          ⓘ
        </button>
      </div>

      {/* Área de texto editable */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe la respuesta en español..."
          maxLength={maxChars}
          className={`w-full h-28 p-3 rounded-xl border bg-slate-50/60 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:bg-white resize-none transition-all leading-relaxed ${
            isDictating ? 'border-red-400/80 ring-2 ring-red-400/20' : 'border-slate-200 focus:border-teal-600'
          }`}
          data-testid="draft-textarea"
        />

        {/* Transcripción en vivo mientras habla */}
        {isDictating && interimTranscript && (
          <div
            className="absolute bottom-6 left-3 right-3 text-xs text-red-600/90 italic bg-white/90 p-1.5 rounded-lg border border-red-200/80 truncate shadow-xs pointer-events-none"
            data-testid="interim-preview"
          >
            🎙️ « {interimTranscript} »
          </div>
        )}

        <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1 px-1">
          {text ? (
            <button
              type="button"
              onClick={clearText}
              className="text-slate-400 hover:text-slate-600 underline cursor-pointer"
            >
              Borrar texto
            </button>
          ) : (
            <span />
          )}
          <span data-testid="char-counter" className={charCount >= maxChars ? 'text-amber-600 font-semibold' : ''}>
            {charCount}/{maxChars}
          </span>
        </div>
      </div>

      {/* Alerta de error si ocurre */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Fila de Acciones: Dictar | Usar teclado | Frases frecuentes */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
        {/* Botón 1: Dictar por voz */}
        <button
          type="button"
          onClick={toggleDictation}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
            isDictating
              ? 'bg-red-50 text-red-700 border-red-300 shadow-xs animate-pulse ring-2 ring-red-300/40'
              : inputMode === 'voice'
              ? 'bg-slate-100 text-slate-800 border-slate-300'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
          data-testid="btn-dictate"
        >
          <span className="text-sm">{isDictating ? '⏹️' : '🎙️'}</span>
          <span>{isDictating ? 'Detener' : 'Dictar'}</span>
        </button>

        {/* Botón 2: Usar teclado */}
        <button
          type="button"
          onClick={handleUseKeyboard}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
            inputMode === 'keyboard' && !isDictating
              ? 'bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
          data-testid="btn-keyboard"
        >
          <span className="text-sm">⌨️</span>
          <span>Usar teclado</span>
        </button>

        {/* Botón 3: Frases frecuentes */}
        <button
          type="button"
          onClick={() => setShowQuickModal((prev) => !prev)}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
            showQuickModal
              ? 'bg-teal-50 text-teal-800 border-teal-300 ring-2 ring-teal-200/50'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
          data-testid="btn-quick-phrases"
        >
          <span className="text-sm">📑</span>
          <span>Frases frecuentes</span>
        </button>
      </div>

      {/* Menú emergente de Frases Frecuentes predeterminadas */}
      {showQuickModal && (
        <div
          className="mt-1 p-3 rounded-xl border border-teal-200 bg-teal-50/40 flex flex-col gap-2 max-h-48 overflow-y-auto"
          data-testid="quick-phrases-dropdown"
        >
          <div className="flex justify-between items-center text-xs font-bold text-teal-900 border-b border-teal-200/60 pb-1.5">
            <span>Plantillas verificadas en LSB:</span>
            <button
              type="button"
              onClick={() => setShowQuickModal(false)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {quickPhrases.map((phrase) => (
              <button
                key={phrase.id}
                type="button"
                onClick={() => handleSelectPhrase(phrase)}
                className="text-left text-xs p-2 rounded-lg bg-white hover:bg-teal-50 border border-slate-200/70 hover:border-teal-300 text-slate-700 transition-colors shadow-2xs"
                data-testid={`phrase-option-${phrase.id}`}
              >
                <div className="font-semibold text-teal-950 text-[11px] mb-0.5">{phrase.label}</div>
                <div className="text-slate-600 truncate">{phrase.text}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botón de Enviar a Vista Previa LSB */}
      {onSendResponse && (
        <button
          type="button"
          onClick={submitResponse}
          disabled={!text.trim()}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${
            text.trim()
              ? 'bg-teal-700 hover:bg-teal-800 text-white cursor-pointer active:scale-[0.99]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
          data-testid="btn-submit-draft"
        >
          <span>Buscar correspondencia en LSB</span>
          <span>→</span>
        </button>
      )}
    </div>
  );
};
