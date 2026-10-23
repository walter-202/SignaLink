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
import { LandmarkOverlay, useLandmarkDetection, LSB_SEQUENCE_LENGTH } from "@/features/sign-recognition";
import { LSB_REFERENCE_V4, formatMiB } from "@/features/sign-recognition/domain/model-catalog";
import type { SignClassifier } from "@/features/sign-recognition/application/ports/sign-classifier";

const recognitionModels = [
  { value: "demo", label: "Demo fija · sin reconocimiento" },
  { value: LSB_REFERENCE_V4.id, label: `LSB de referencia · v4 · ${formatMiB(LSB_REFERENCE_V4.modelBytes)}` },
];

const landmarksEnabledByDefault = process.env.NEXT_PUBLIC_SIGN_LANDMARKS !== "off";
type ModelLoadStatus = "idle" | "loading" | "ready" | "error";

interface CameraPanelProps {
  camera: UseCameraReturn;
}

export function CameraPanel({ camera }: CameraPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [model, setModel] = useState("demo");
  const [modelLoadStatus, setModelLoadStatus] = useState<ModelLoadStatus>("idle");
  const [modelLoadDetail, setModelLoadDetail] = useState("");
  const [modelLoadAttempt, setModelLoadAttempt] = useState(0);
  const [modelCaptureError, setModelCaptureError] = useState<string | null>(null);
  const [landmarksEnabled, setLandmarksEnabled] = useState(landmarksEnabledByDefault);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const classifierRef = useRef<SignClassifier | null>(null);
  const sequenceRef = useRef<Float32Array[]>([]);
  const visibleHandFramesRef = useRef(0);
  const captureGenerationRef = useRef(0);
  const previousStatusRef = useRef<CameraStatus>("idle");
  const captureStatus = useAttentionStore((state) => state.captureStatus);
  const captureProgress = useAttentionStore((state) => state.captureProgress);
  const startCapture = useAttentionStore((state) => state.startCapture);
  const beginModelCapture = useAttentionStore((state) => state.beginModelCapture);
  const setCaptureProgress = useAttentionStore((state) => state.setCaptureProgress);
  const setCaptureProcessing = useAttentionStore((state) => state.setCaptureProcessing);
  const completeModelCapture = useAttentionStore((state) => state.completeModelCapture);
  const cancelCapture = useAttentionStore((state) => state.cancelCapture);
  const failNext = useAttentionStore((state) => state.failNextRecognition);
  const setFailNext = useAttentionStore((state) => state.setFailNextRecognition);
  const setMode = useAttentionStore((state) => state.setMode);
  const records = useAttentionStore((state) => state.records);
  const activeRecordId = useAttentionStore((state) => state.activeRecordId);
  const sessionActive = records.find((record) => record.id === activeRecordId)?.status === "active";
  const captureBusy = captureStatus === "capturing" || captureStatus === "processing";
  const isReferenceModel = model === LSB_REFERENCE_V4.id;
  const landmarkDetection = useLandmarkDetection({
    video: videoElement,
    enabled: camera.isActive && landmarksEnabled,
  });
  const canCapture = isReferenceModel
    ? sessionActive && camera.isActive && landmarksEnabled && landmarkDetection.status === "ready" && modelLoadStatus === "ready" && !captureBusy
    : sessionActive && camera.isActive && !captureBusy;
  const canUseDemo = sessionActive && !captureBusy;
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoElement(node);
  }, []);

  useEffect(() => {
    if (!isReferenceModel) {
      classifierRef.current?.close();
      classifierRef.current = null;
      return;
    }

    let cancelled = false;
    let classifier: SignClassifier | null = null;

    void import("@/features/sign-recognition/infrastructure/onnx-lsb-classifier")
      .then(async ({ OnnxLsbReferenceClassifier }) => {
        if (cancelled) return;
        classifier = new OnnxLsbReferenceClassifier();
        classifierRef.current = classifier;
        await classifier.initialize((message) => {
          if (!cancelled) setModelLoadDetail(message);
        });
        if (!cancelled) {
          setModelLoadStatus("ready");
          setModelLoadDetail("Modelo cargado y verificado localmente.");
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        classifier?.close();
        classifierRef.current = null;
        setModelLoadStatus("error");
        setModelLoadDetail(cause instanceof Error ? cause.message : "No se pudo cargar el modelo.");
      });

    return () => {
      cancelled = true;
      captureGenerationRef.current += 1;
      const status = useAttentionStore.getState().captureStatus;
      if (status === "capturing" || status === "processing") cancelCapture();
      if (classifierRef.current === classifier) classifierRef.current = null;
      classifier?.close();
    };
  }, [isReferenceModel, modelLoadAttempt, cancelCapture]);

  useEffect(() => {
    if (captureStatus === "capturing" && isReferenceModel && landmarkDetection.features) {
      const sequence = sequenceRef.current;
      if (sequence.length >= LSB_SEQUENCE_LENGTH) return;
      sequence.push(new Float32Array(landmarkDetection.features));
      const detectedHands = landmarkDetection.landmarks;
      if (detectedHands?.leftHand?.length || detectedHands?.rightHand?.length) {
        visibleHandFramesRef.current += 1;
      }
      setCaptureProgress(sequence.length);
      if (sequence.length === LSB_SEQUENCE_LENGTH) {
        const generation = captureGenerationRef.current;
        const classifier = classifierRef.current;
        setCaptureProcessing();
        if (!classifier) {
          cancelCapture();
          setModelCaptureError("El modelo se cerró antes de completar la captura. Vuelve a cargarlo.");
          return;
        }
        const capturedSequence = sequence.slice();
        if (visibleHandFramesRef.current < LSB_SEQUENCE_LENGTH / 2) {
          cancelCapture();
          setModelCaptureError("No hubo manos visibles en suficientes fotogramas. Centra las manos y vuelve a capturar.");
          return;
        }
        void classifier.classify(capturedSequence)
          .then((prediction) => {
            if (generation !== captureGenerationRef.current) return;
            if (prediction.confidence < LSB_REFERENCE_V4.confidenceThreshold || !prediction.label.trim()) {
              cancelCapture();
              setModelCaptureError(
                `No se obtuvo una etiqueta por encima del umbral de 50% (puntuación ${(prediction.confidence * 100).toFixed(1)}%). Ajusta el encuadre e intenta otra vez.`,
              );
              return;
            }
            setModelCaptureError(null);
            completeModelCapture(prediction.label, prediction.confidence);
          })
          .catch((cause: unknown) => {
            if (generation !== captureGenerationRef.current) return;
            cancelCapture();
            setModelCaptureError(cause instanceof Error ? cause.message : "Falló la inferencia local.");
          });
      }
    }
  }, [
    landmarkDetection.features,
    landmarkDetection.landmarks,
    captureStatus,
    isReferenceModel,
    setCaptureProgress,
    setCaptureProcessing,
    cancelCapture,
    completeModelCapture,
  ]);

  useEffect(() => {
    if (!isReferenceModel) return;
    if (camera.isActive && landmarksEnabled && landmarkDetection.status === "ready") return;
    if (captureStatus !== "capturing" && captureStatus !== "processing") return;
    captureGenerationRef.current += 1;
    sequenceRef.current = [];
    visibleHandFramesRef.current = 0;
    cancelCapture();
  }, [isReferenceModel, camera.isActive, landmarksEnabled, landmarkDetection.status, captureStatus, cancelCapture]);

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
    setModelCaptureError(null);
    void startCapture();
  }

  function handleLsbCapture() {
    if (!classifierRef.current || modelLoadStatus !== "ready") return;
    captureGenerationRef.current += 1;
    sequenceRef.current = [];
    visibleHandFramesRef.current = 0;
    setModelCaptureError(null);
    setMode("capture");
    beginModelCapture();
  }

  function handleShutter() {
    if (isReferenceModel) handleLsbCapture();
    else void startCapture();
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
        : isReferenceModel && modelLoadStatus === "loading"
          ? "Cargando el modelo local; espera para capturar."
          : isReferenceModel && modelLoadStatus === "error"
            ? "No se pudo cargar el modelo; abre ajustes para reintentar."
            : isReferenceModel && modelLoadStatus === "idle"
              ? "Selecciona el modelo en ajustes para iniciar su carga local."
          : isReferenceModel && !landmarksEnabled
            ? "Activa los landmarks locales en los ajustes para usar el modelo."
            : isReferenceModel && landmarkDetection.status === "loading"
              ? "Esperando que los landmarks estén listos."
              : isReferenceModel && landmarkDetection.status === "error"
                ? "No se pudieron cargar los landmarks; revisa la conexión y vuelve a activar la cámara."
              : camera.isActive
                ? isReferenceModel
                  ? "Mantén manos y torso visibles; la secuencia tarda cerca de 2 segundos."
                  : "Mantén las manos y el torso visibles."
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
            <p>Cámara y clasificador LSB</p>
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
            {captureStatus === "capturing"
              ? isReferenceModel
                ? `Capturando ${captureProgress}/${LSB_SEQUENCE_LENGTH}…`
                : "Preparando captura…"
              : isReferenceModel
                ? "Clasificando en este dispositivo…"
                : "Procesando demostración…"}
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
            onClick={handleShutter}
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

      {modelCaptureError ? <p className="camera-model-error" role="alert">{modelCaptureError}</p> : null}
      {isReferenceModel && modelLoadStatus === "loading" ? (
        <p className="camera-model-status" role="status">{modelLoadDetail}</p>
      ) : null}
      {isReferenceModel && modelLoadStatus === "ready" ? (
        <p className="camera-model-status" role="status">Modelo LSB de referencia listo · inferencia local</p>
      ) : null}

      <p className="camera-disclaimer">
        <ShieldCheck size={14} aria-hidden="true" />
        Video, landmarks y clasificación se procesan en este navegador; no se graban ni se envían. El modelo v4 es experimental y su vocabulario es limitado.
      </p>

      <Dialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Ajustes de captura"
        description="La cámara y la inferencia se ejecutan en el dispositivo; el modelo solo se descarga al seleccionarlo."
      >
        <div className="camera-settings-block">
          <label className="field-label" htmlFor="recognition-model">Modelo de reconocimiento</label>
          <Select
            id="recognition-model"
            label="Modelo de reconocimiento"
            value={model}
            options={recognitionModels}
            onValueChange={(nextModel) => {
              setModel(nextModel);
              setModelCaptureError(null);
              if (nextModel === LSB_REFERENCE_V4.id) {
                setModelLoadStatus("loading");
                setModelLoadDetail("Preparando el motor de inferencia local…");
              }
            }}
            className="select-trigger--full"
          />
          {model === "demo" ? (
            <p className="help-text">La demo devuelve una frase fija; no ejecuta reconocimiento de señas.</p>
          ) : (
            <div className="camera-model-load-state" aria-live="polite">
              {modelLoadStatus === "loading" ? <p className="help-text" role="status">{modelLoadDetail}</p> : null}
              {modelLoadStatus === "ready" ? <p className="help-text" role="status">{modelLoadDetail} SHA-256 verificado. El runtime WASM también se guarda en caché del navegador.</p> : null}
              {modelLoadStatus === "error" ? (
                <div>
                  <p className="field-error" role="alert">{modelLoadDetail}</p>
                  <Button variant="secondary" size="small" onClick={() => {
                    setModelLoadStatus("loading");
                    setModelLoadDetail("Preparando el motor de inferencia local…");
                    setModelLoadAttempt((attempt) => attempt + 1);
                  }}>Reintentar carga</Button>
                </div>
              ) : null}
              {modelLoadStatus === "idle" ? (
                <p className="help-text">Primer uso: descarga {formatMiB(LSB_REFERENCE_V4.modelBytes)} de modelo y aproximadamente 13.6 MiB de runtime WASM. Se procesa todo localmente.</p>
              ) : null}
              <p className="help-text">Baseline experimental de 58 etiquetas y secuencias aisladas de 30 fotogramas. No es traducción continua ni LSB general. <a href={LSB_REFERENCE_V4.sourceUrl} target="_blank" rel="noreferrer">Proyecto y licencia MIT</a>.</p>
            </div>
          )}
        </div>
        <label className="setting-row">
          <span><strong>Detectar landmarks en el navegador</strong><small>MediaPipe procesa la pose y las manos localmente; el video no se envía.</small></span>
          <input
            type="checkbox"
            checked={landmarksEnabled}
            onChange={(event) => setLandmarksEnabled(event.currentTarget.checked)}
          />
        </label>
        {model === "demo" ? (
          <label className="setting-row">
            <span><strong>Simular un error en la próxima captura</strong><small>La siguiente demo mostrará un error para probar el reintento.</small></span>
            <input type="checkbox" checked={failNext} onChange={(event) => setFailNext(event.currentTarget.checked)} />
          </label>
        ) : null}
        <p className="help-text">Encuadre sugerido: buena iluminación, manos y torso visibles. La vista previa no se almacena.</p>
      </Dialog>
    </section>
  );
}
