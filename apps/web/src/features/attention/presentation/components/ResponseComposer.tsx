"use client";

import { useRef, useState, type Ref } from "react";
import { Bookmark, Info, Keyboard, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { VoiceInputButton } from "@/features/communication";
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
  const [source, setSource] = useState<"typed" | "frequent-phrase" | "dictation">("typed");
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const [dictationActive, setDictationActive] = useState(false);
  const [composerNotice, setComposerNotice] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const dictationBaseRef = useRef("");
  const sessionActive = records.find((record) => record.id === activeRecordId)?.status === "active";

  function handleSend() {
    if (sendReply(source)) setSource("typed");
  }

  function startDictation() {
    dictationBaseRef.current = draft.trim();
    setSource("dictation");
    setComposerNotice("");
  }

  function updateDraftFromDictation(transcript: string) {
    const text = transcript.trim();
    if (!text) return;
    const nextDraft = [dictationBaseRef.current, text].filter(Boolean).join(" ");
    setDraft(nextDraft.slice(0, 500));
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
        disabled={!sessionActive || dictationActive}
        placeholder={!sessionActive ? "Inicia una atención para responder." : dictationActive ? "El dictado está activo…" : "Escribe una respuesta en español…"}
        aria-describedby={draftError ? "response-error" : "response-counter"}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          setSource("typed");
          setComposerNotice("");
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
        <VoiceInputButton
          disabled={!sessionActive}
          onStart={startDictation}
          onListeningChange={setDictationActive}
          onTranscriptComplete={updateDraftFromDictation}
        />
        <Button size="small" variant="secondary" onClick={() => document.getElementById("response-draft")?.focus()} disabled={!sessionActive || dictationActive}>
          <Keyboard size={15} aria-hidden="true" /> Usar teclado
        </Button>
        <Button
          size="small"
          variant="secondary"
          aria-expanded={phrasesOpen}
          aria-controls="frequent-phrases"
          onClick={() => setPhrasesOpen((open) => !open)}
          disabled={!sessionActive || dictationActive}
        >
          <Bookmark size={15} aria-hidden="true" /> Frases frecuentes
        </Button>
        <Button
          className="send-response-button"
          size="small"
          variant="primary"
          onClick={handleSend}
          disabled={!sessionActive || dictationActive || !draft.trim()}
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
                setComposerNotice("Frase añadida al borrador para revisar.");
              }}
            >
              {phrase}
            </button>
          ))}
        </div>
      ) : null}
      {composerNotice ? <p className="composer-notice" role="status">{composerNotice}</p> : null}
      <Dialog
        open={infoOpen}
        onOpenChange={setInfoOpen}
        title="Redactar una respuesta"
        description="Escribe en español, revisa el mensaje y envíalo cuando esté listo."
      >
        <ul className="dialog-list">
          <li>El dictado usa el servicio del navegador; el tratamiento del audio depende de ese proveedor.</li>
          <li>Revisa y corrige la transcripción antes de enviar la respuesta.</li>
          <li>Las frases frecuentes quedan en el borrador para que puedas revisarlas.</li>
          <li>El avatar es una vista de demostración, no una traducción validada a LSB.</li>
        </ul>
      </Dialog>
    </section>
  );
}
