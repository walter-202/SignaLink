"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Info, ShieldCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { StatusIndicator } from "@/components/feedback/StatusIndicator";
import { useAttentionStore } from "@/features/attention/application/attention-store";
import { useCamera } from "@/features/camera";
import { formatProcedureDateTime } from "@/features/procedure-history/application/filter-history";
import { AvatarPreview } from "./components/AvatarPreview";
import { CameraPanel } from "./components/CameraPanel";
import { ConversationPanel } from "./components/ConversationPanel";
import { ResponseComposer } from "./components/ResponseComposer";

const procedureOptions = [
  "Registro ciudadano",
  "Certificado de nacimiento",
  "Renovación de documento",
  "Solicitud de información",
  "Orientación general",
].map((label) => ({ value: label, label }));

export function AttentionWorkspace() {
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [procedureInfoOpen, setProcedureInfoOpen] = useState(false);
  const [toast, setToast] = useState("");
  const responseRef = useRef<HTMLTextAreaElement>(null);
  const records = useAttentionStore((state) => state.records);
  const activeRecordId = useAttentionStore((state) => state.activeRecordId);
  const procedureType = useAttentionStore((state) => state.procedureType);
  const setProcedureType = useAttentionStore((state) => state.setProcedureType);
  const notes = useAttentionStore((state) => state.notes);
  const notesError = useAttentionStore((state) => state.notesError);
  const setNotes = useAttentionStore((state) => state.setNotes);
  const setMode = useAttentionStore((state) => state.setMode);
  const finishAttention = useAttentionStore((state) => state.finishAttention);
  const startNewAttention = useAttentionStore((state) => state.startNewAttention);
  const record = records.find((item) => item.id === activeRecordId) ?? records[0];
  const sessionActive = record?.status === "active";
  const camera = useCamera();
  const stopCamera = camera.stop;

  useEffect(() => {
    stopCamera();
  }, [activeRecordId, stopCamera]);

  useEffect(() => {
    if (!sessionActive) stopCamera();
  }, [sessionActive, stopCamera]);

  function handleRespond() {
    setMode("reply");
    responseRef.current?.focus();
  }

  function handleCapture() {
    setMode("capture");
    void camera.start();
    const panel = document.getElementById("camera-capture-panel");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }

  function confirmFinish() {
    finishAttention();
    setConfirmFinishOpen(false);
    setToast("La atención de demostración se marcó como finalizada.");
    window.setTimeout(() => setToast(""), 4_000);
  }

  function handleNewAttention() {
    startNewAttention();
    setToast("Nueva atención de demostración iniciada.");
    window.setTimeout(() => setToast(""), 4_000);
  }

  return (
    <div className="workspace-page attention-page">
      <header className="page-heading attention-page-heading">
        <div>
          <p className="eyebrow">Comunicación bidireccional con apoyo de LSB</p>
          <h1>Atención de trámite</h1>
          <p>Revisa cada mensaje con la persona antes de continuar.</p>
        </div>
        <div className="attention-heading-actions">
          {sessionActive ? (
            <div className="procedure-select-wrap">
              <span className="field-label">Trámite</span>
              <Select
                id="procedure-type"
                label="Tipo de trámite"
                value={procedureType}
                options={procedureOptions}
                onValueChange={setProcedureType}
                className="procedure-select"
              />
            </div>
          ) : (
            <span className="finished-session-label"><Check size={15} aria-hidden="true" /> Atención finalizada</span>
          )}
          {sessionActive ? (
            <Button variant="danger" onClick={() => setConfirmFinishOpen(true)}>
              Finalizar atención <Square size={14} aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="primary" onClick={handleNewAttention}>Iniciar nueva atención</Button>
          )}
        </div>
      </header>

      <div className="attention-grid">
        <div className="attention-column attention-column--capture">
          <CameraPanel camera={camera} />
        </div>
        <div className="attention-column attention-column--conversation">
          <ConversationPanel onRespond={handleRespond} onUseSigns={handleCapture} />
        </div>
        <aside className="attention-column attention-column--response" aria-label="Respuesta y datos del trámite">
          <ResponseComposer textareaRef={responseRef} />
          <AvatarPreview />
          <section className="panel-card procedure-info-card" aria-labelledby="procedure-info-title">
            <header className="compact-card-heading">
              <div className="inline-title"><ShieldCheck size={17} aria-hidden="true" /><h2 id="procedure-info-title">Datos del trámite</h2></div>
              <button className="subtle-icon-button" type="button" aria-label="Información del trámite" title="Información del trámite" onClick={() => setProcedureInfoOpen(true)}><Info size={15} aria-hidden="true" /></button>
            </header>
            <dl className="procedure-facts">
              <div><dt>Tipo</dt><dd>{record?.procedureType ?? procedureType}</dd></div>
              <div><dt>Estado</dt><dd>{record ? <StatusIndicator status={record.status} /> : "—"}</dd></div>
              <div><dt>Inicio</dt><dd>{record ? formatProcedureDateTime(record.startedAt) : "—"}</dd></div>
              <div><dt>Duración</dt><dd>{record?.durationMinutes ?? 0} min</dd></div>
            </dl>
          </section>
          <section className="panel-card notes-card" aria-labelledby="notes-title">
            <header className="compact-card-heading"><h2 id="notes-title">Observaciones</h2><span className="notes-local-badge">Solo en sesión</span></header>
            <label className="sr-only" htmlFor="procedure-notes">Observaciones internas</label>
            <textarea
              id="procedure-notes"
              value={notes}
              maxLength={300}
              disabled={!sessionActive}
              placeholder="Agrega una nota interna sobre esta atención…"
              onChange={(event) => setNotes(event.currentTarget.value)}
              aria-describedby={notesError ? "notes-error" : "notes-counter"}
            />
            <div className="composer-count-row">
              {notesError ? <span className="field-error" id="notes-error" role="alert">{notesError}</span> : <span className="help-text">No se guarda fuera de esta sesión.</span>}
              <span className="character-count" id="notes-counter">{notes.length} / 300</span>
            </div>
          </section>
        </aside>
      </div>

      <p className="prototype-note"><strong>Demostración:</strong> el reconocimiento usa una respuesta fija; la vista del avatar no corresponde a una traducción LSB validada.</p>
      <div className="sr-only" role="status" aria-live="polite">{toast}</div>

      <Dialog
        open={procedureInfoOpen}
        onOpenChange={setProcedureInfoOpen}
        title="Datos del trámite"
        description="El tipo se elige manualmente para organizar esta atención de demostración."
      >
        <p>Los datos del trámite y las observaciones no se envían a una institución ni se guardan fuera de la sesión actual.</p>
      </Dialog>

      <Dialog
        open={confirmFinishOpen}
        onOpenChange={setConfirmFinishOpen}
        title="¿Finalizar esta atención?"
        description="La atención se marcará como finalizada en los datos de demostración de esta sesión."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirmFinishOpen(false)}>Seguir atendiendo</Button>
            <Button variant="danger" onClick={confirmFinish}>Sí, finalizar</Button>
          </>
        )}
      >
        <div className="finish-summary">
          <strong>{record?.id}</strong>
          <span>{record?.procedureType}</span>
          <span>{record?.messages.length ?? 0} mensajes revisados en esta conversación.</span>
        </div>
      </Dialog>
    </div>
  );
}
