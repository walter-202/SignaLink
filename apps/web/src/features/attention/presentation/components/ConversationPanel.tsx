"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCheck, Info, MessageCircle, Keyboard, RotateCcw, ShieldCheck, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAttentionStore } from "@/features/attention/application/attention-store";
import type { ConversationMessage } from "@/features/procedure-history/domain/types";

interface ConversationPanelProps {
  onRespond: () => void;
  onUseSigns: () => void;
}

function getMessageSourceLabel(source: ConversationMessage["source"]): string {
  switch (source) {
    case "reviewed-sign": return "captura de demostración revisada";
    case "frequent-phrase": return "frase frecuente";
    case "dictation": return "dictado del navegador";
    case "demo": return "demostración";
    case "typed": return "texto";
  }
}

export function ConversationPanel({ onRespond, onUseSigns }: ConversationPanelProps) {
  const messages = useAttentionStore((state) => state.messages);
  const captureStatus = useAttentionStore((state) => state.captureStatus);
  const captureText = useAttentionStore((state) => state.captureText);
  const captureError = useAttentionStore((state) => state.captureError);
  const confirmCapture = useAttentionStore((state) => state.confirmCapture);
  const setCaptureText = useAttentionStore((state) => state.setCaptureText);
  const cancelCapture = useAttentionStore((state) => state.cancelCapture);
  const retryCapture = useAttentionStore((state) => state.retryCapture);
  const clearCapture = useAttentionStore((state) => state.clearCapture);
  const records = useAttentionStore((state) => state.records);
  const activeRecordId = useAttentionStore((state) => state.activeRecordId);
  const sessionActive = records.find((record) => record.id === activeRecordId)?.status === "active";
  const [selectedMessage, setSelectedMessage] = useState<ConversationMessage | null>(null);
  const [conversationInfoOpen, setConversationInfoOpen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    list.scrollTo({ top: list.scrollHeight, behavior });
  }, [messages.length, captureStatus]);

  return (
    <section className="panel-card conversation-panel" aria-labelledby="conversation-title">
      <header className="panel-heading conversation-heading">
        <div className="inline-title">
          <MessageCircle size={19} aria-hidden="true" />
          <h2 id="conversation-title">Conversación</h2>
          <button className="subtle-icon-button" type="button" aria-label="Información sobre la conversación" title="Información sobre la conversación" onClick={() => setConversationInfoOpen(true)}>
            <Info size={15} aria-hidden="true" />
          </button>
        </div>
        <span className="review-badge"><ShieldCheck size={14} aria-hidden="true" /> Revisión manual</span>
      </header>

      <ol className="conversation-timeline" ref={listRef} aria-label="Mensajes de la atención" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <li className="conversation-empty">
            <MessageCircle size={23} aria-hidden="true" />
            <strong>La conversación comienza aquí</strong>
            <span>Captura una seña de demostración o escribe una respuesta.</span>
          </li>
        ) : messages.map((message) => {
          const isCitizen = message.sender === "citizen";
          return (
            <li className={`message-row ${isCitizen ? "message-row--citizen" : "message-row--staff"}`} key={message.id}>
              {isCitizen ? <span className="message-avatar message-avatar--citizen" aria-hidden="true"><UserRound size={17} /></span> : null}
              <button
                className={`message-bubble ${isCitizen ? "message-bubble--citizen" : "message-bubble--staff"}`}
                type="button"
                onClick={() => setSelectedMessage(message)}
                aria-label={`Ver detalle del mensaje de ${isCitizen ? "la persona usuaria" : "personal de atención"}: ${message.text}`}
              >
                <span className="message-author">
                  {isCitizen ? "Persona usuaria · LSB → Español (demo)" : `Personal de atención · ${getMessageSourceLabel(message.source)}`}
                </span>
                <span className="message-text">{message.text}</span>
                <span className="message-meta">
                  <time>{message.time}</time>
                  {message.state === "confirmed" ? <CheckCheck size={14} aria-label="Revisado" /> : <CheckCheck size={14} aria-label="Enviado" />}
                </span>
              </button>
              {!isCitizen ? <span className="message-avatar message-avatar--staff" aria-hidden="true"><UserRound size={17} /></span> : null}
            </li>
          );
        })}
      </ol>

      {captureStatus === "capturing" || captureStatus === "processing" ? (
        <div className="capture-progress" role="status">
          <span className="spinner" aria-hidden="true" />
          {captureStatus === "capturing" ? "Preparando una captura de demostración…" : "Preparando una propuesta para revisión…"}
        </div>
      ) : null}

      {captureStatus === "reviewing" ? (
        <div className="message-review" aria-labelledby="review-title">
          <div className="review-title-row">
            <div><ShieldCheck size={16} aria-hidden="true" /><strong id="review-title">Propuesta de interpretación</strong></div>
            <span>Revisa antes de confirmar</span>
          </div>
          <label className="sr-only" htmlFor="capture-proposal">Editar propuesta</label>
          <textarea id="capture-proposal" value={captureText} maxLength={500} onChange={(event) => setCaptureText(event.currentTarget.value)} />
          <p className="help-text">Resultado fijo de demostración; no es reconocimiento ni traducción LSB validada.</p>
          <div className="review-actions">
            <Button variant="secondary" size="small" onClick={cancelCapture}><X size={14} aria-hidden="true" /> Descartar</Button>
            <Button variant="secondary" size="small" onClick={() => void retryCapture()}><RotateCcw size={14} aria-hidden="true" /> Reintentar</Button>
            <Button variant="primary" size="small" onClick={confirmCapture}><ShieldCheck size={14} aria-hidden="true" /> Confirmar mensaje</Button>
          </div>
        </div>
      ) : null}

      {captureStatus === "error" ? (
        <div className="capture-error" role="alert">
          <div><strong>No se pudo preparar la propuesta</strong><span>{captureError}</span></div>
          <div className="review-actions">
            <Button variant="secondary" size="small" onClick={cancelCapture}><X size={14} aria-hidden="true" /> Cancelar</Button>
            <Button variant="primary" size="small" onClick={() => void retryCapture()}><RotateCcw size={14} aria-hidden="true" /> Reintentar</Button>
          </div>
        </div>
      ) : null}

      {captureStatus === "confirmed" ? (
        <div className="capture-confirmed" role="status">
          <span><CheckCheck size={15} aria-hidden="true" /> Mensaje añadido después de la revisión.</span>
          <button type="button" onClick={clearCapture}>Cerrar</button>
        </div>
      ) : null}

      <footer className="conversation-actions">
        <Button variant="secondary" size="large" onClick={onUseSigns} disabled={!sessionActive}>
          <CameraActionIcon /> <span><strong>Usar señas</strong><small>Capturar mensaje simulado</small></span>
        </Button>
        <Button variant="secondary" size="large" onClick={onRespond} disabled={!sessionActive}>
          <Keyboard size={20} aria-hidden="true" /> <span><strong>Responder</strong><small>Escribir o dictar</small></span>
        </Button>
      </footer>

      <Dialog
        open={selectedMessage !== null}
        onOpenChange={(open) => { if (!open) setSelectedMessage(null); }}
        title="Detalle del mensaje"
        description={selectedMessage ? `${selectedMessage.sender === "citizen" ? "Persona usuaria" : "Personal de atención"} · ${selectedMessage.time}` : undefined}
      >
        {selectedMessage ? (
          <div className="message-detail">
            <p>{selectedMessage.text}</p>
            <span>Estado: {selectedMessage.state === "confirmed" ? "revisado" : "enviado"}</span>
            <span>Origen: {getMessageSourceLabel(selectedMessage.source)}</span>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={conversationInfoOpen}
        onOpenChange={setConversationInfoOpen}
        title="Revisión de la conversación"
        description="Los mensajes se quedan en esta sesión de demostración."
      >
        <p>Las interpretaciones simuladas solo se añaden después de que el personal las revisa y confirma. No constituyen una traducción LSB validada.</p>
      </Dialog>
    </section>
  );
}

function CameraActionIcon() {
  return <Camera size={20} aria-hidden="true" />;
}
