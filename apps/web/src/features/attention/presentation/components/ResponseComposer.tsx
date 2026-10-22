"use client";

import { useState, type Ref } from "react";
import { Bookmark, Info, Keyboard, Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAttentionStore } from "@/features/attention/application/attention-store";

const frequentPhrases = [
  "Puede realizarlo de lunes a viernes, de 8:00 a 16:00.",
  "Necesitará presentar su documento de identidad.",
  "Con gusto, le explico los pasos disponibles.",
];

interface ResponseComposerProps {
  textareaRef?: Ref<HTMLTextAreaElement>;
}

export function ResponseComposer({ textareaRef }: ResponseComposerProps) {
  const draft = useAttentionStore((state) => state.draft);
  const draftError = useAttentionStore((state) => state.draftError);
  const setDraft = useAttentionStore((state) => state.setDraft);
  const sendReply = useAttentionStore((state) => state.sendReply);
  const records = useAttentionStore((state) => state.records);
  const activeRecordId = useAttentionStore((state) => state.activeRecordId);
  const [source, setSource] = useState<"typed" | "frequent-phrase" | "demo">("typed");
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const [dictationNotice, setDictationNotice] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const sessionActive = records.find((record) => record.id === activeRecordId)?.status === "active";

  function handleSend() {
    if (sendReply(source)) setSource("typed");
  }

  function simulateDictation() {
    const sample = "Su atención se encuentra en proceso.";
    setDraft(draft ? `${draft.trim()} ${sample}`.trim() : sample);
    setSource("demo");
    setDictationNotice("Se añadió una frase de ejemplo para revisar. No se activó el micrófono.");
  }

  return (
    <section className="panel-card composer-card" aria-labelledby="composer-title">
      <header className="compact-card-heading">
        <h2 id="composer-title">Redactar respuesta</h2>
          <button className="subtle-icon-button" type="button" aria-label="Información sobre las respuestas" title="Información sobre las respuestas" onClick={() => setInfoOpen(true)}>
          <Info size={15} aria-hidden="true" />
        </button>
      </header>
      <label className="sr-only" htmlFor="response-draft">Respuesta para la conversación</label>
      <textarea
        ref={textareaRef}
        id="response-draft"
        className="response-textarea"
        rows={2}
        maxLength={500}
        value={draft}
        disabled={!sessionActive}
        placeholder={sessionActive ? "Escribe una respuesta en español…" : "Inicia una atención para responder."}
        aria-describedby={draftError ? "response-error" : "response-counter"}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          setSource("typed");
          setDictationNotice("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            handleSend();
          }
        }}
      />
      <div className="composer-count-row">
        {draftError ? <span className="field-error" id="response-error" role="alert">{draftError}</span> : <span className="help-text" id="response-counter">Ctrl + Enter para enviar</span>}
        <span className="character-count">{draft.length} / 500</span>
      </div>
      <div className="composer-tools">
        <Button size="small" variant="secondary" onClick={simulateDictation} disabled={!sessionActive}>
          <Mic size={15} aria-hidden="true" /> Dictar
        </Button>
        <Button size="small" variant="secondary" onClick={() => document.getElementById("response-draft")?.focus()} disabled={!sessionActive}>
          <Keyboard size={15} aria-hidden="true" /> Usar teclado
        </Button>
        <Button
          size="small"
          variant="secondary"
          aria-expanded={phrasesOpen}
          aria-controls="frequent-phrases"
          onClick={() => setPhrasesOpen((open) => !open)}
          disabled={!sessionActive}
        >
          <Bookmark size={15} aria-hidden="true" /> Frases frecuentes
        </Button>
        <Button
          className="send-response-button"
          size="small"
          variant="primary"
          onClick={handleSend}
          disabled={!sessionActive || !draft.trim()}
          aria-label="Enviar respuesta"
          title="Enviar respuesta"
        >
          <Send size={14} aria-hidden="true" /> Enviar
        </Button>
      </div>
      {phrasesOpen ? (
        <div className="frequent-phrases" id="frequent-phrases" aria-label="Frases frecuentes">
          {frequentPhrases.map((phrase) => (
            <button
              type="button"
              key={phrase}
              onClick={() => {
                setDraft(phrase);
                setSource("frequent-phrase");
                setPhrasesOpen(false);
                setDictationNotice("Frase añadida al borrador para revisar.");
              }}
            >
              {phrase}
            </button>
          ))}
        </div>
      ) : null}
      {dictationNotice ? <p className="composer-notice" role="status">{dictationNotice}</p> : null}
      <Dialog
        open={infoOpen}
        onOpenChange={setInfoOpen}
        title="Redactar una respuesta"
        description="Escribe en español, revisa el mensaje y envíalo cuando esté listo."
      >
        <ul className="dialog-list">
          <li>El dictado añade una frase fija de ejemplo y no activa el micrófono.</li>
          <li>Las frases frecuentes quedan en el borrador para que puedas revisarlas.</li>
          <li>El avatar es una vista de demostración, no una traducción validada a LSB.</li>
        </ul>
      </Dialog>
    </section>
  );
}
