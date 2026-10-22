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
  const isReady = useAttentionStore((state) => state.isReady);
  const isSaving = useAttentionStore((state) => state.isSaving);
  const syncError = useAttentionStore((state) => state.syncError);
  const loadRecords = useAttentionStore((state) => state.loadRecords);
  const activeRecordId = useAttentionStore((state) => state.activeRecordId);
  const procedureType = useAttentionStore((state) => state.procedureType);
  const setProcedureType = useAttentionStore((state) => state.setProcedureType);
  const notes = useAttentionStore((state) => state.notes);
  const notesError = useAttentionStore((state) => state.notesError);
  const notesDirty = useAttentionStore((state) => state.notesDirty);
  const setNotes = useAttentionStore((state) => state.setNotes);
  const saveNotes = useAttentionStore((state) => state.saveNotes);
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

  async function confirmFinish() {
    await finishAttention();
    if (useAttentionStore.getState().syncError) return;
    setConfirmFinishOpen(false);
    setToast("La atención se guardó como finalizada.");
    window.setTimeout(() => setToast(""), 4_000);
  }

  async function handleNewAttention() {
    await startNewAttention();
    if (useAttentionStore.getState().syncError) return;
    setToast("Nueva atención iniciada y guardada.");
    window.setTimeout(() => setToast(""), 4_000);
  }

  if (!isReady) {
    return <div className="workspace-loading" role="status"><span className="spinner" aria-hidden="true" /> Cargando atenciones guardadas…</div>;
  }

  if (records.length === 0) {
    return (
      <div className="workspace-page attention-empty-state">
        <div className="panel-card">
          <h1>Inicia una atención</h1>
          <p>Las atenciones, observaciones y mensajes se guardarán en tu cuenta de personal.</p>
          {syncError ? <p className="sync-error" role="alert">{syncError}</p> : null}
          <Button variant="primary" onClick={() => void handleNewAttention()} disabled={isSaving}>
            {isSaving ? "Iniciando…" : "Iniciar atención"}
          </Button>
          {syncError ? <Button variant="secondary" onClick={() => void loadRecords()}>Reintentar carga</Button> : null}
        </div>
      </div>
    );
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
            <Button variant="danger" onClick={() => setConfirmFinishOpen(true)} disabled={isSaving}>
              Finalizar atención <Square size={14} aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void handleNewAttention()} disabled={isSaving}>
              {isSaving ? "Guardando…" : "Iniciar nueva atención"}
            </Button>
          )}
        </div>
      </header>

      {syncError ? <p className="sync-error" role="alert">{syncError}</p> : null}

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
            <header className="compact-card-heading"><h2 id="notes-title">Observaciones</h2><span className="notes-local-badge">{notesDirty ? "Pendiente de guardar" : "Guardado"}</span></header>
            <label className="sr-only" htmlFor="procedure-notes">Observaciones internas</label>
            <textarea
              id="procedure-notes"
              value={notes}
              maxLength={300}
              disabled={!sessionActive}
              placeholder="Agrega una nota interna sobre esta atención…"
              onChange={(event) => setNotes(event.currentTarget.value)}
              onBlur={() => void saveNotes()}
              aria-describedby={notesError ? "notes-error" : "notes-counter"}
            />
            <div className="composer-count-row">
              {notesError ? <span className="field-error" id="notes-error" role="alert">{notesError}</span> : <span className="help-text">Se guarda al salir del campo.</span>}
              <span className="character-count" id="notes-counter">{notes.length} / 300</span>
            </div>
          </section>
        </aside>
      </div>

      <p className="prototype-note"><strong>Revisión humana:</strong> la propuesta de señas todavía es demostrativa; confirma o corrige el texto antes de guardarlo. La cámara y sus imágenes no se almacenan.</p>
      <div className="sr-only" role="status" aria-live="polite">{toast}</div>

      <Dialog
        open={procedureInfoOpen}
        onOpenChange={setProcedureInfoOpen}
        title="Datos del trámite"
        description="El tipo se elige manualmente y se guarda con la atención."
      >
        <p>Los mensajes y observaciones se guardan en esta cuenta de personal. La aplicación solo persiste texto; no sube imágenes, video ni audio de la cámara.</p>
      </Dialog>

      <Dialog
        open={confirmFinishOpen}
        onOpenChange={setConfirmFinishOpen}
        title="¿Finalizar esta atención?"
        description="La atención se marcará como finalizada y quedará guardada en tu historial."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirmFinishOpen(false)}>Seguir atendiendo</Button>
            <Button variant="danger" onClick={() => void confirmFinish()} disabled={isSaving}>Sí, finalizar</Button>
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
