"use client";

import * as Tabs from "@radix-ui/react-tabs";
import Image from "next/image";
import { Camera, CircleHelp, Cog, Hand, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useAttentionStore } from "@/features/attention/application/attention-store";

const recognitionModels = [
  { value: "demo", label: "Modelo de referencia · desconectado" },
  { value: "fixture", label: "Interpretación fija · demostración" },
];

export function CameraPanel() {
  const [activeTab, setActiveTab] = useState("capture");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [model, setModel] = useState("demo");
  const captureStatus = useAttentionStore((state) => state.captureStatus);
  const startCapture = useAttentionStore((state) => state.startCapture);
  const failNext = useAttentionStore((state) => state.failNextRecognition);
  const setFailNext = useAttentionStore((state) => state.setFailNextRecognition);
  const setMode = useAttentionStore((state) => state.setMode);
  const records = useAttentionStore((state) => state.records);
  const activeRecordId = useAttentionStore((state) => state.activeRecordId);
  const sessionActive = records.find((record) => record.id === activeRecordId)?.status === "active";

  const modelState = captureStatus === "processing"
    ? { label: "Procesando", className: "recognition-state--processing" }
    : captureStatus === "error"
      ? { label: "Error de prueba", className: "recognition-state--error" }
      : captureStatus === "reviewing"
        ? { label: "Revisar propuesta", className: "recognition-state--review" }
        : { label: "No conectado", className: "recognition-state--idle" };

  return (
    <section className="panel-card camera-panel" aria-label="Captura y reconocimiento de señas">
      <Tabs.Root className="camera-tabs" value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="camera-tabs-list" aria-label="Herramientas de comunicación">
          <Tabs.Trigger className="camera-tab" value="capture">
            <Camera size={16} aria-hidden="true" /> Capturar señas
          </Tabs.Trigger>
          <Tabs.Trigger className="camera-tab" value="playback">
            <Play size={15} aria-hidden="true" /> Reproducir respuesta
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content className="camera-tab-panel" value="capture">
          <div className="camera-viewport">
            <Image
              className="camera-demo-image"
              width={880}
              height={1000}
              src="/images/camera-signing-demo.png"
              alt="Imagen ilustrativa de una persona mostrando las manos en un encuadre de práctica"
              loading="eager"
            />
            <span className="camera-status-chip"><span aria-hidden="true" /> Cámara simulada</span>
            <Button
              className="camera-settings-button"
              variant="ghost"
              size="icon"
              type="button"
              aria-label="Opciones de la demostración de cámara"
              onClick={() => setSettingsOpen(true)}
            >
              <Cog size={17} aria-hidden="true" />
            </Button>
            <span className="camera-corner camera-corner--tl" aria-hidden="true" />
            <span className="camera-corner camera-corner--tr" aria-hidden="true" />
            <span className="camera-corner camera-corner--bl" aria-hidden="true" />
            <span className="camera-corner camera-corner--br" aria-hidden="true" />
            {captureStatus === "capturing" || captureStatus === "processing" ? (
              <span className="camera-processing" role="status">
                {captureStatus === "capturing" ? "Preparando captura…" : "Procesando demostración…"}
              </span>
            ) : null}
          </div>
          <div className="camera-controls">
            <span className="fps-badge"><Camera size={14} aria-hidden="true" /> 30 FPS · demo</span>
            <Button
              variant="primary"
              size="capture"
              type="button"
              onClick={() => void startCapture()}
              disabled={!sessionActive || captureStatus === "capturing" || captureStatus === "processing"}
              aria-label="Capturar una seña simulada"
            >
              <Camera size={22} aria-hidden="true" />
            </Button>
            <span className="lsb-badge"><Hand size={15} aria-hidden="true" /> LSB</span>
          </div>
          <p className="camera-disclaimer">No se solicita acceso a tu cámara. La imagen y el resultado son de demostración.</p>
        </Tabs.Content>

        <Tabs.Content className="camera-tab-panel playback-tab-panel" value="playback">
          <div className="response-preview-image">
            <Image width={800} height={800} src="/images/avatar-demo.png" alt="Avatar 3D de demostración, sin seña validada" />
            <span className="demo-label">Vista de demostración</span>
          </div>
          <p>La respuesta visual se revisa en el panel de avatar. Esta pestaña no representa una traducción LSB.</p>
          <Button variant="secondary" onClick={() => setMode("reply")}>
            <Play size={15} aria-hidden="true" /> Ir a redactar respuesta
          </Button>
        </Tabs.Content>
      </Tabs.Root>

      <div className="recognition-card">
        <div className="recognition-heading">
          <div className="inline-title"><Hand size={17} aria-hidden="true" /><h3>Reconocimiento (IA)</h3></div>
          <span className={`recognition-state ${modelState.className}`}><span aria-hidden="true" />{modelState.label}</span>
        </div>
        <label className="field-label" htmlFor="recognition-model">Modelo</label>
        <Select
          id="recognition-model"
          label="Modelo de reconocimiento"
          value={model}
          options={recognitionModels}
          onValueChange={setModel}
          className="select-trigger--full"
        />
        <p className="info-callout">
          <CircleHelp size={15} aria-hidden="true" />
          El modelo no está conectado. La captura devuelve una frase fija para probar el flujo.
        </p>
      </div>

      <Dialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Ajustes de captura simulada"
        description="La cámara real está desactivada en este prototipo."
      >
        <label className="setting-row">
          <span><strong>Probar un error de reconocimiento</strong><small>La próxima captura mostrará un error que puedes reintentar o cancelar.</small></span>
          <input type="checkbox" checked={failNext} onChange={(event) => setFailNext(event.currentTarget.checked)} />
        </label>
        <p className="help-text">Encuadre sugerido: buena iluminación, manos y torso visibles.</p>
      </Dialog>
    </section>
  );
}
