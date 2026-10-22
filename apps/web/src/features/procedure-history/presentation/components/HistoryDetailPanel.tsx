"use client";

import { useState } from "react";
import { MessageCircle, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { StatusIndicator } from "@/components/feedback/StatusIndicator";
import { formatProcedureDateTime } from "../../application/filter-history";
import type { HistoryRecord } from "../../domain/types";

interface HistoryDetailPanelProps {
  record: HistoryRecord | undefined;
  onReopen: (recordId: string) => void;
}

export function HistoryDetailPanel({ record, onReopen }: HistoryDetailPanelProps) {
  const [conversationOpen, setConversationOpen] = useState(false);
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);

  if (!record) {
    return (
      <aside className="panel-card history-detail-card history-detail-empty">
        <MessageCircle size={25} aria-hidden="true" />
        <strong>Selecciona una atención</strong>
        <span>Sus detalles aparecerán aquí.</span>
      </aside>
    );
  }

  const latest = record.messages.at(-1);
  const canReopen = record.status === "completed";
  const visibleMessages = record.messages.slice(-4);

  return (
    <aside className="panel-card history-detail-card" aria-labelledby="detail-title">
      <header className="detail-heading">
        <h2 id="detail-title">Detalle de la atención</h2>
        <StatusIndicator status={record.status} />
      </header>
      <section className="detail-section">
        <h3>Información general</h3>
        <dl className="detail-facts">
          <div><dt>ID / Referencia</dt><dd>{record.id}</dd></div>
          <div><dt>Tipo de trámite</dt><dd>{record.procedureType}</dd></div>
          <div><dt>Fecha y hora</dt><dd>{formatProcedureDateTime(record.startedAt)}</dd></div>
          <div><dt>Duración</dt><dd>{record.durationMinutes} min</dd></div>
        </dl>
      </section>

      <section className="detail-section conversation-summary-section">
        <div className="detail-section-heading"><h3>Resumen de la conversación</h3><span>{record.messages.length} mensajes</span></div>
        {visibleMessages.length ? (
          <ul className="conversation-summary">
            {visibleMessages.map((message) => (
              <li className={message.sender === "staff" ? "summary-message summary-message--staff" : "summary-message"} key={message.id}>
                <span className={`summary-avatar ${message.sender === "staff" ? "summary-avatar--staff" : ""}`} aria-hidden="true"><UserRound size={15} /></span>
                <span><strong>{message.sender === "citizen" ? "Persona usuaria" : "Personal de atención"}</strong><span>{message.text}</span><time>{message.time}</time></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="help-text">Esta atención aún no contiene mensajes.</p>
        )}
      </section>

      <section className="detail-section latest-message-section">
        <h3>Último mensaje</h3>
        {latest ? (
          <div className="latest-message"><p>{latest.text}</p><time>{latest.time}</time></div>
        ) : <p className="help-text">Todavía no hay mensajes.</p>}
      </section>

      <section className="detail-section observations-section">
        <h3>Observaciones</h3>
        <p>{record.notes || "Sin observaciones registradas."}</p>
      </section>

      <footer className="detail-actions">
        <Button variant="primary" onClick={() => setConversationOpen(true)}>
          <MessageCircle size={15} aria-hidden="true" /> Ver conversación
        </Button>
        {canReopen ? (
          <Button variant="secondary" onClick={() => setReopenConfirmOpen(true)}>
            <RotateCcw size={15} aria-hidden="true" /> Reabrir atención
          </Button>
        ) : null}
      </footer>

      <Dialog
        open={conversationOpen}
        onOpenChange={setConversationOpen}
        title={`Conversación · ${record.id}`}
        description="Resumen de mensajes de esta atención de demostración."
        className="conversation-dialog"
      >
        <ol className="dialog-conversation-list">
          {record.messages.map((message) => (
            <li className={message.sender === "staff" ? "dialog-message dialog-message--staff" : "dialog-message"} key={message.id}>
              <strong>{message.sender === "citizen" ? "Persona usuaria · LSB → Español (demo)" : "Personal de atención · texto"}</strong>
              <p>{message.text}</p>
              <time>{message.time}</time>
            </li>
          ))}
        </ol>
      </Dialog>

      <Dialog
        open={reopenConfirmOpen}
        onOpenChange={setReopenConfirmOpen}
        title="¿Reabrir esta atención?"
        description="La acción solo cambia el estado de los datos de demostración en esta sesión."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setReopenConfirmOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={() => { onReopen(record.id); setReopenConfirmOpen(false); }}>
              <ShieldCheck size={15} aria-hidden="true" /> Reabrir atención
            </Button>
          </>
        )}
      >
        <p className="finish-summary"><strong>{record.id}</strong><span>{record.procedureType}</span></p>
      </Dialog>
    </aside>
  );
}
