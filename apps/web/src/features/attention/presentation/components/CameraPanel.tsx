"use client";

import {
  Camera,
  CameraOff,
  Cog,
  Hand,
  LoaderCircle,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  TriangleAlert,
  VideoOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useAttentionStore } from "@/features/attention/application/attention-store";
import type { CameraStatus, UseCameraReturn } from "@/features/camera";
import { LandmarkOverlay, useLandmarkDetection } from "@/features/sign-recognition";

const recognitionModels = [
  { value: "demo", label: "Modelo de referencia · desconectado" },
  { value: "fixture", label: "Interpretación fija · demostración" },
];

const landmarksEnabledByDefault = process.env.NEXT_PUBLIC_SIGN_LANDMARKS !== "off";

interface CameraPanelProps {
  camera: UseCameraReturn;
}

export function CameraPanel({ camera }: CameraPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [model, setModel] = useState("demo");
  const [landmarksEnabled, setLandmarksEnabled] = useState(landmarksEnabledByDefault);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousStatusRef = useRef<CameraStatus>("idle");
  const captureStatus = useAttentionStore((state) => state.captureStatus);
  const startCapture = useAttentionStore((state) => state.startCapture);
  const failNext = useAttentionStore((state) => state.failNextRecognition);
  const setFailNext = useAttentionStore((state) => state.setFailNextRecognition);
  const setMode = useAttentionStore((state) => state.setMode);
  const records = useAttentionStore((state) => state.records);
  const activeRecordId = useAttentionStore((state) => state.activeRecordId);
  const sessionActive = records.find((record) => record.id === activeRecordId)?.status === "active";
  const captureBusy = captureStatus === "capturing" || captureStatus === "processing";
  const canCapture = sessionActive && camera.isActive && !captureBusy;
  const canUseDemo = sessionActive && !captureBusy;
  const landmarkDetection = useLandmarkDetection({
    video: videoElement,
    enabled: camera.isActive && landmarksEnabled,
  });
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoElement(node);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !camera.stream) return;
    video.srcObject = camera.stream;
    void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [camera.stream]);

  useEffect(() => {
    if (camera.isActive && previousStatusRef.current !== "active") {
      document.getElementById("camera-shutter")?.focus({ preventScroll: true });
    } else if (!camera.isActive && previousStatusRef.current === "active") {
      document.getElementById("camera-primary-action")?.focus({ preventScroll: true });
    }
    previousStatusRef.current = camera.status;
  }, [camera.isActive, camera.status]);

  function handleDemoCapture() {
    setMode("capture");
    void startCapture();
  }

  const statusChip = camera.status === "active"
    ? { label: "Cámara activa", className: "camera-status-chip--active" }
    : camera.status === "requesting"
      ? { label: "Solicitando permiso…", className: "camera-status-chip--pending" }
      : camera.status === "error"
        ? { label: "Cámara no disponible", className: "camera-status-chip--error" }
        : camera.isSupported
          ? { label: "Cámara apagada", className: "camera-status-chip--idle" }
          : { label: "Cámara no disponible", className: "camera-status-chip--idle" };

  const landmarkStatus = !landmarksEnabled
    ? { label: "Landmarks apagados", className: "camera-landmark-chip--idle" }
    : landmarkDetection.status === "ready"
      ? { label: "Landmarks activos", className: "camera-landmark-chip--active" }
      : landmarkDetection.status === "loading"
        ? { label: "Cargando landmarks…", className: "camera-landmark-chip--pending" }
        : landmarkDetection.status === "error"
          ? { label: "Landmarks no disponibles", className: "camera-landmark-chip--error" }
          : { label: "Landmarks en espera", className: "camera-landmark-chip--idle" };
  const landmarkStatusTitle = landmarkDetection.error
    ?? (landmarksEnabled
      ? "La pose y las manos se procesan localmente en este navegador."
      : "Activa la detección local de landmarks en los ajustes de captura.");

  let stageTitle = "Activa la vista previa";
  let stageMessage = "Actívala cuando la persona esté lista para acompañar la conversación con señas.";

  if (!sessionActive) {
    stageTitle = "Sesión cerrada";
    stageMessage = "Inicia una nueva atención para volver a usar la cámara.";
  } else if (camera.status === "requesting") {
    stageTitle = "Esperando permiso";
    stageMessage = "Acepta el acceso a la cámara en el navegador para ver la vista previa.";
  } else if (camera.status === "error") {
    stageTitle = "No se pudo activar la cámara";
    stageMessage = camera.error ?? "Puedes reintentar o usar la captura de demostración.";
  } else if (!camera.isSupported) {
    stageTitle = "Cámara no disponible";
    stageMessage = "Este navegador no permite acceder a la cámara. Puedes usar la captura de demostración o escribir la respuesta.";
  }

  const captureHint = !sessionActive
    ? "Inicia una nueva atención para capturar."
    : camera.status === "requesting"
      ? "Esperando acceso a la cámara."
      : camera.status === "error"
        ? "La captura está deshabilitada."
        : camera.isActive
          ? "Mantén las manos y el torso visibles."
          : "La captura se habilita al activar la cámara.";

  const showPrimaryAction = sessionActive && camera.isSupported && camera.status !== "requesting";
  const showDemoAction = sessionActive && camera.status !== "requesting";

  return (
    <section id="camera-capture-panel" className="panel-card camera-panel" aria-label="Captura y reconocimiento de señas">
      <header className="camera-panel-heading">
        <div className="camera-panel-title">
          <span className="camera-panel-icon" aria-hidden="true"><Camera size={17} /></span>
          <div>
            <h2>Captura de señas</h2>
            <p>Cámara y demo LSB</p>
          </div>
        </div>
        <Button
          className="camera-panel-settings"
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Ajustes de captura"
          title="Ajustes de captura"
          onClick={() => setSettingsOpen(true)}
        >
          <Cog size={17} aria-hidden="true" />
        </Button>
      </header>

      <div className={`camera-viewport ${camera.stream ? "camera-viewport--live" : ""}`}>
        {camera.stream ? (
          <>
            <video
              ref={setVideoRef}
              className="camera-video"
              autoPlay
              muted
              playsInline
              controls={false}
              disablePictureInPicture
              aria-label="Vista previa en vivo de la cámara"
            />
            {videoElement ? (
              <LandmarkOverlay video={videoElement} frame={landmarkDetection.landmarks} />
            ) : null}
          </>
        ) : (
          <div
            className={`camera-stage camera-stage--${sessionActive ? camera.status : "finished"}`}
            role={sessionActive && camera.status === "error" ? "alert" : undefined}
          >
            <div
              className={`camera-stage-visual ${camera.status === "error" ? "camera-stage-visual--error" : ""}`}
              aria-hidden="true"
            >
              {camera.status === "requesting"
                ? <LoaderCircle className="camera-spinner" size={30} />
                : camera.status === "error"
                  ? <TriangleAlert size={30} />
                  : sessionActive && camera.isSupported
                    ? <Hand size={30} />
                    : <CameraOff size={30} />}
            </div>
            <div className="camera-stage-content">
              <div className="camera-stage-copy">
                <strong>{stageTitle}</strong>
                <p>{stageMessage}</p>
              </div>
              {sessionActive ? (
                <div className="camera-stage-actions">
                  {camera.status === "requesting" ? (
                    <Button
                      className="camera-stage-secondary"
                      variant="ghost"
                      size="small"
                      onClick={camera.stop}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                  {showPrimaryAction ? (
                    <Button
                      id="camera-primary-action"
                      className="camera-stage-primary"
                      variant="secondary"
                      size="small"
                      onClick={() => void camera.start()}
                    >
                      {camera.status === "error"
                        ? <RotateCcw size={15} aria-hidden="true" />
                        : <Camera size={15} aria-hidden="true" />}
                      {camera.status === "error" ? "Reintentar" : "Activar cámara"}
                    </Button>
                  ) : null}
                  {showDemoAction ? (
                    <Button
                      className="camera-stage-secondary"
                      variant="ghost"
                      size="small"
                      onClick={handleDemoCapture}
                      disabled={!canUseDemo}
                    >
                      Usar captura de demostración
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <span className={`camera-status-chip ${statusChip.className}`} role="status">
          <span aria-hidden="true" /> {statusChip.label}
        </span>

        {camera.stream ? (
          <div className="camera-live-overlay">
            <div className="camera-live-meta">
              <span><ShieldCheck size={13} aria-hidden="true" /> Vista local</span>
              <span
                className={`camera-landmark-chip ${landmarkStatus.className}`}
                role="status"
                title={landmarkStatusTitle}
              >
                <ScanFace size={13} aria-hidden="true" /> {landmarkStatus.label}
              </span>
            </div>
            <Button className="camera-live-stop" variant="ghost" size="small" onClick={camera.stop}>
              <VideoOff size={14} aria-hidden="true" /> Detener cámara
            </Button>
          </div>
        ) : null}

        {captureBusy ? (
          <span className="camera-processing" role="status">
            <LoaderCircle className="camera-spinner" size={14} aria-hidden="true" />
            {captureStatus === "capturing" ? "Preparando captura…" : "Procesando demostración…"}
          </span>
        ) : null}
      </div>

      <div className="camera-control-row">
        <p className="camera-control-hint" id="camera-capture-hint">{captureHint}</p>
        <div className="camera-shutter-group">
          <Button
            id="camera-shutter"
            variant="primary"
            size="capture"
            type="button"
            onClick={() => void startCapture()}
            disabled={!canCapture}
            title={camera.isActive ? undefined : "Activa la cámara para capturar"}
            aria-label="Capturar una seña con la cámara"
            aria-describedby="camera-capture-hint"
            aria-busy={captureBusy}
          >
            {captureBusy
              ? <LoaderCircle className="camera-spinner" size={22} aria-hidden="true" />
              : <Camera size={22} aria-hidden="true" />}
          </Button>
          <span className="camera-shutter-label" aria-hidden="true">
            {captureBusy ? "Procesando" : "Capturar"}
          </span>
        </div>
        <span className="lsb-badge" title="Lengua de Señas Boliviana">
          <Hand size={15} aria-hidden="true" /> LSB
        </span>
      </div>

      <p className="camera-disclaimer">
        <ShieldCheck size={14} aria-hidden="true" />
        Vista previa y landmarks locales, sin grabación. El reconocimiento es una demostración.
      </p>

      <Dialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Ajustes de captura"
        description="La cámara se activa solo con una acción explícita y se detiene al finalizar la atención."
      >
        <div className="camera-settings-block">
          <label className="field-label" htmlFor="recognition-model">Modelo de reconocimiento</label>
          <Select
            id="recognition-model"
            label="Modelo de reconocimiento"
            value={model}
            options={recognitionModels}
            onValueChange={setModel}
            className="select-trigger--full"
          />
          <p className="help-text">El modelo de interpretación no está conectado. La captura devuelve una frase fija para probar el flujo.</p>
        </div>
        <label className="setting-row">
          <span><strong>Detectar landmarks en el navegador</strong><small>MediaPipe procesa la pose y las manos localmente; el video no se envía.</small></span>
          <input
            type="checkbox"
            checked={landmarksEnabled}
            onChange={(event) => setLandmarksEnabled(event.currentTarget.checked)}
          />
        </label>
        <label className="setting-row">
          <span><strong>Simular un error en la próxima captura</strong><small>La siguiente captura mostrará un error para probar el reintento.</small></span>
          <input type="checkbox" checked={failNext} onChange={(event) => setFailNext(event.currentTarget.checked)} />
        </label>
        <p className="help-text">Encuadre sugerido: buena iluminación, manos y torso visibles. La vista previa no se almacena.</p>
      </Dialog>
    </section>
  );
}
