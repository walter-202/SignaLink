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
  Square,
  TriangleAlert,
  VideoOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAttentionStore } from "@/features/attention/application/attention-store";
import type { CameraStatus, UseCameraReturn } from "@/features/camera";
import {
  LandmarkOverlay,
  useLandmarkDetection,
} from "@/features/sign-recognition";
import { formatMiB } from "@/features/sign-recognition/domain/model-catalog";
import { useRecognitionModel, useLandmarkRuntime, type LandmarkRuntimeMode } from "@/features/sign-recognition/presentation/SignRecognitionContext";
import { BrowserResponsivenessMonitor } from "@/features/sign-recognition/infrastructure/browser-responsiveness-monitor";
import { ContinuousRecognitionPipeline } from "@/features/sign-recognition/application/continuous-recognition-pipeline";
import { RecognitionPerformance } from "@/features/sign-recognition/application/recognition-performance";
import { decideModelCapture, type AcceptedCaptureLabel } from "@/features/sign-recognition/application/model-capture-policy";
import { RecognitionDiagnostics } from "@/features/sign-recognition/presentation/components/RecognitionDiagnostics";
import type { SignClassifier } from "@/features/sign-recognition/application/ports/sign-classifier";

const landmarksEnabledByDefault = process.env.NEXT_PUBLIC_SIGN_LANDMARKS !== "off";
const duplicateLabelWindowMs = 900;
type ModelLoadStatus = "loading" | "ready" | "error";

interface CameraPanelProps {
  camera: UseCameraReturn;
}

export function CameraPanel({ camera }: CameraPanelProps) {
  const { model, models, selectModel } = useRecognitionModel();
  const landmarkRuntime = useLandmarkRuntime();
  const { manifest } = model;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelLoadStatus, setModelLoadStatus] = useState<ModelLoadStatus>("loading");
  const [loadedModelKey, setLoadedModelKey] = useState<string | null>(null);
  const currentModelReady = modelLoadStatus === "ready" && loadedModelKey === `${manifest.id}@${manifest.version}`;
  const [modelLoadDetail, setModelLoadDetail] = useState("Preparando el motor de inferencia local…");
  const [modelLoadAttempt, setModelLoadAttempt] = useState(0);
  const [modelCaptureError, setModelCaptureError] = useState<string | null>(null);
  const [landmarksEnabled, setLandmarksEnabled] = useState(landmarksEnabledByDefault);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const classifierRef = useRef<SignClassifier | null>(null);
  const pipelineRef = useRef<ContinuousRecognitionPipeline | null>(null);
  const [metrics] = useState(() => new RecognitionPerformance());
  const lastAcceptedRef = useRef<AcceptedCaptureLabel | null>(null);
  const lastProgressRef = useRef(0);
  const previousContinuousRef = useRef(false);
  const preserveCaptureErrorRef = useRef(false);
  const measuredLandmarkModeRef = useRef(landmarkRuntime.mode);
  const previousStatusRef = useRef<CameraStatus>("idle");
  const captureStatus = useAttentionStore((state) => state.captureStatus);
  const captureProgress = useAttentionStore((state) => state.captureProgress);
  const continuousCapture = useAttentionStore((state) => state.continuousCapture);
  const startContinuousCapture = useAttentionStore((state) => state.startContinuousCapture);
  const appendModelCapture = useAttentionStore((state) => state.appendModelCapture);
  const resumeContinuousCapture = useAttentionStore((state) => state.resumeContinuousCapture);
  const stopContinuousCapture = useAttentionStore((state) => state.stopContinuousCapture);
  const setCaptureProgress = useAttentionStore((state) => state.setCaptureProgress);
  const setCaptureProcessing = useAttentionStore((state) => state.setCaptureProcessing);
  const cancelCapture = useAttentionStore((state) => state.cancelCapture);
  const setMode = useAttentionStore((state) => state.setMode);
  const records = useAttentionStore((state) => state.records);
  const activeRecordId = useAttentionStore((state) => state.activeRecordId);
  const sessionActive = records.find((record) => record.id === activeRecordId)?.status === "active";
  const handleLandmarkFrame = useCallback((...args: Parameters<ContinuousRecognitionPipeline["push"]>) => {
    pipelineRef.current?.push(...args);
  }, []);
  const landmarkDetection = useLandmarkDetection({
    video: videoElement,
    enabled: camera.isActive && landmarksEnabled,
    frameIntervalMs: manifest.frameIntervalMs,
    extractFeatures: model.extractFeatures,
    onFrame: handleLandmarkFrame,
    metrics,
  });
  const canStartRecognition = sessionActive
    && camera.isActive
    && landmarksEnabled
    && landmarkDetection.status === "ready"
    && currentModelReady
    && captureStatus !== "reviewing";

  useEffect(() => {
    if (measuredLandmarkModeRef.current === landmarkRuntime.mode) return;
    measuredLandmarkModeRef.current = landmarkRuntime.mode;
    // Stop the segmenter before any frame from a different detector can arrive.
    pipelineRef.current?.stop();
    const state = useAttentionStore.getState();
    if (state.continuousCapture || state.captureStatus === "capturing" || state.captureStatus === "processing") cancelCapture();
    lastAcceptedRef.current = null;
    lastProgressRef.current = 0;
    metrics.reset();
  }, [landmarkRuntime.mode, cancelCapture, metrics]);

  useEffect(() => {
    if (!camera.isActive || !landmarksEnabled) return;
    const monitor = new BrowserResponsivenessMonitor(metrics);
    monitor.start();
    return () => monitor.stop();
  }, [camera.isActive, landmarksEnabled, landmarkRuntime.mode, metrics]);

  function changeLandmarkMode(mode: LandmarkRuntimeMode) {
    const state = useAttentionStore.getState();
    if (state.continuousCapture || state.captureStatus === "capturing" || state.captureStatus === "reviewing" || state.captureStatus === "processing") return;
    if (mode === landmarkRuntime.mode) return;
    pipelineRef.current?.stop();
    metrics.reset();
    landmarkRuntime.selectMode(mode);
  }
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoElement(node);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let classifier: SignClassifier | null = null;
    const loadingStartedAt = performance.now();

    metrics.reset();
    queueMicrotask(() => {
      if (cancelled) return;
      setModelLoadStatus("loading");
      setModelLoadDetail("Preparando el motor de inferencia local…");
      setModelCaptureError(null);
    });
    void model.createClassifier(metrics)
      .then(async (createdClassifier) => {
        classifier = createdClassifier;
        if (cancelled) { classifier.close(); return; }
        classifierRef.current = classifier;
        await classifier.initialize((message) => {
          if (!cancelled) setModelLoadDetail(message);
        });
        if (!cancelled) {
          metrics.record("modelLoadMs", performance.now() - loadingStartedAt);
          pipelineRef.current = new ContinuousRecognitionPipeline({
            classifier,
            sequenceLength: manifest.inputShape[1],
            performance: metrics,
            onProgress: (progress) => {
              if (lastProgressRef.current === progress) return;
              // Publish progress roughly every three frames; recognition still receives every frame.
              if (progress !== 0 && lastProgressRef.current !== 0 && Math.abs(progress - lastProgressRef.current) < 3) return;
              lastProgressRef.current = progress;
              setCaptureProgress(Math.round(100 * progress / manifest.inputShape[1]));
            },
            onProcessing: setCaptureProcessing,
            onPrediction: (prediction) => {
              if (!useAttentionStore.getState().continuousCapture) return;
              const now = performance.now();
              const decision = decideModelCapture(prediction, manifest, lastAcceptedRef.current, now, duplicateLabelWindowMs);
              if (decision.kind === "model-mismatch") {
                preserveCaptureErrorRef.current = true;
                pipelineRef.current?.stop();
                stopContinuousCapture();
                setModelCaptureError("La predicción pertenece a otro modelo. Vuelve a iniciar el reconocimiento.");
                return;
              }
              if (decision.kind === "uncertain") {
                metrics.increment("uncertain");
                resumeContinuousCapture();
                setModelCaptureError(`No se reconoció una etiqueta por encima del umbral de ${Math.round(manifest.confidenceThreshold * 100)}% y el margen mínimo del modelo (puntuación ${Number.isFinite(prediction.confidence) ? `${(prediction.confidence * 100).toFixed(1)}%` : "no válida"}). Repite la seña con manos y torso visibles.`);
                return;
              }
              if (decision.kind === "duplicate") {
                metrics.increment("duplicates");
                resumeContinuousCapture();
                return;
              }
              lastAcceptedRef.current = decision.next;
              metrics.increment("accepted");
              setModelCaptureError(null);
              appendModelCapture(prediction.label, prediction.confidence);
            },
            onError: (message, code) => {
              resumeContinuousCapture();
              setModelCaptureError(message);
              if (code === "overloaded" || code === "stale") {
                pipelineRef.current?.stop();
                preserveCaptureErrorRef.current = true;
                stopContinuousCapture();
              }
            },
          });
          setLoadedModelKey(`${manifest.id}@${manifest.version}`);
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
      pipelineRef.current?.stop();
      pipelineRef.current = null;
      const status = useAttentionStore.getState();
      if (status.continuousCapture || status.captureStatus === "capturing" || status.captureStatus === "processing") {
        cancelCapture();
      }
      if (classifierRef.current === classifier) classifierRef.current = null;
      classifier?.close();
    };
  }, [model, manifest, modelLoadAttempt, cancelCapture, metrics, appendModelCapture, resumeContinuousCapture, setCaptureProgress, setCaptureProcessing, stopContinuousCapture]);

  useEffect(() => {
    pipelineRef.current?.stop();
    if (useAttentionStore.getState().continuousCapture) cancelCapture();
  }, [activeRecordId, cancelCapture]);

  useEffect(() => {
    if (!continuousCapture && previousContinuousRef.current) {
      pipelineRef.current?.stop();
      lastProgressRef.current = 0;
      if (preserveCaptureErrorRef.current) {
        preserveCaptureErrorRef.current = false;
      } else {
        setModelCaptureError(null);
      }
    }
    previousContinuousRef.current = continuousCapture;
  }, [continuousCapture]);

  useEffect(() => {
    if (!continuousCapture) return;
    if (camera.isActive && landmarksEnabled && landmarkDetection.status === "ready" && currentModelReady) return;
    pipelineRef.current?.stop();
    lastProgressRef.current = 0;
    stopContinuousCapture();
  }, [
    camera.isActive,
    continuousCapture,
    landmarkDetection.status,
    landmarksEnabled,
    currentModelReady,
    stopContinuousCapture,
  ]);

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

  function handleRecognitionToggle() {
    if (continuousCapture) {
      pipelineRef.current?.stop();
      lastProgressRef.current = 0;
      setModelCaptureError(null);
      stopContinuousCapture();
      return;
    }

    if (!canStartRecognition || !pipelineRef.current) return;

    pipelineRef.current?.start();
    lastAcceptedRef.current = null;
    lastProgressRef.current = 0;
    preserveCaptureErrorRef.current = false;
    setModelCaptureError(null);
    setMode("capture");
    startContinuousCapture();
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
    stageMessage = camera.error ?? "Puedes reintentar o escribir la respuesta.";
  } else if (!camera.isSupported) {
    stageTitle = "Cámara no disponible";
    stageMessage = "Este navegador no permite acceder a la cámara. Puedes escribir la respuesta.";
  }

  const captureHint = !sessionActive
    ? "Inicia una nueva atención para capturar."
    : camera.status === "requesting"
      ? "Esperando acceso a la cámara."
      : camera.status === "error"
        ? "La captura está deshabilitada."
        : modelLoadStatus === "loading"
          ? "Cargando el modelo local; espera para capturar."
          : modelLoadStatus === "error"
            ? "No se pudo cargar el modelo; abre ajustes para reintentar."
            : !landmarksEnabled
              ? "Activa los landmarks locales en los ajustes para usar el modelo."
              : landmarkDetection.status === "loading"
                ? "Esperando que los landmarks estén listos."
                : landmarkDetection.status === "error"
                  ? "No se pudieron cargar los landmarks; revisa la conexión y vuelve a activar la cámara."
                  : continuousCapture
                    ? captureStatus === "processing"
                      ? "Clasificando la seña en este dispositivo…"
                      : captureProgress > 0
                        ? `Capturando ${captureProgress}%…`
                        : "Esperando una seña; mueve las manos o detén para revisar."
                    : captureStatus === "reviewing"
                      ? "Confirma o descarta la transcripción antes de iniciar otra captura."
                      : camera.isActive
                        ? "Inicia el reconocimiento continuo; las señas estables se agregan al texto."
                        : "La captura se habilita al activar la cámara.";

  const showPrimaryAction = sessionActive && camera.isSupported && camera.status !== "requesting";

  return (
    <section id="camera-capture-panel" className="panel-card camera-panel" aria-label="Captura y reconocimiento de señas">
      <header className="camera-panel-heading">
        <div className="camera-panel-title">
          <span className="camera-panel-icon" aria-hidden="true"><Camera size={17} /></span>
          <div>
            <h2>Captura de señas</h2>
            <p>Cámara y clasificador {manifest.languageCode}</p>
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

        {continuousCapture ? (
          <span className="camera-processing">
            {captureStatus === "processing"
              ? <LoaderCircle className="camera-spinner" size={14} aria-hidden="true" />
              : <ScanFace size={14} aria-hidden="true" />}
            {captureStatus === "processing"
              ? "Clasificando en este dispositivo…"
              : captureProgress > 0
                ? `Capturando ${captureProgress}%…`
                : "Esperando una seña…"}
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
            onClick={handleRecognitionToggle}
            disabled={!continuousCapture && !canStartRecognition}
            title={!camera.isActive
              ? "Activa la cámara para reconocer señas"
              : captureStatus === "reviewing"
                ? "Confirma o descarta la transcripción pendiente"
                : undefined}
            aria-label={continuousCapture ? "Detener reconocimiento continuo" : "Iniciar reconocimiento continuo"}
            aria-pressed={continuousCapture}
            aria-describedby="camera-capture-hint"
            aria-busy={captureStatus === "processing"}
          >
            {continuousCapture
              ? <Square size={20} fill="currentColor" aria-hidden="true" />
              : <Camera size={22} aria-hidden="true" />}
          </Button>
          <span className="camera-shutter-label" aria-hidden="true">
            {continuousCapture ? "Detener" : "Iniciar"}
          </span>
        </div>
        <span className="lsb-badge" title={manifest.language}>
          <Hand size={15} aria-hidden="true" /> {manifest.languageCode}
        </span>
      </div>

      {modelCaptureError ? <p className="camera-model-error" role="alert">{modelCaptureError}</p> : null}
      {modelLoadStatus === "loading" ? (
        <p className="camera-model-status" role="status">{modelLoadDetail}</p>
      ) : null}
      {currentModelReady ? (
        <p className="camera-model-status" role="status">{manifest.name} listo · inferencia local</p>
      ) : null}

      <p className="camera-disclaimer">
        <ShieldCheck size={14} aria-hidden="true" />
        Video, landmarks y clasificación se procesan en este navegador; no se graban ni se envían. {manifest.validationStatus === "experimental" ? "Modelo experimental; cada propuesta requiere revisión humana." : "Cada propuesta requiere revisión humana."}
      </p>

      <Dialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Ajustes de captura"
        description="La cámara y la inferencia se ejecutan en el dispositivo; el modelo seleccionado se carga automáticamente."
      >
        <div className="camera-settings-block">
          <label className="field-label" htmlFor="recognition-model">Modelo de reconocimiento</label>
          <select
            id="recognition-model"
            className="native-select"
            value={manifest.id}
            disabled={models.length < 2 || continuousCapture || captureStatus === "reviewing" || modelLoadStatus === "loading"}
            onChange={(event) => selectModel(event.currentTarget.value)}
          >
            {models.map((item) => <option key={item.id} value={item.id} disabled={!item.executionApproved}>{item.name} · v{item.version}</option>)}
          </select>
          <p className="help-text">{models.length < 2 ? "Solo hay un modelo disponible en esta instalación." : "Detén la captura y resuelve la transcripción antes de cambiar de modelo."}</p>
          <p className="camera-model-name">
            <strong>{manifest.name}</strong> · v{manifest.version} · {formatMiB(manifest.modelBytes)}
          </p>
          <div className="camera-model-load-state" aria-live="polite">
            {modelLoadStatus === "loading" ? <p className="help-text" role="status">{modelLoadDetail}</p> : null}
            {currentModelReady ? <p className="help-text" role="status">{modelLoadDetail} SHA-256 verificado. El runtime WASM también se guarda en caché del navegador.</p> : null}
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
            <p className="help-text">{manifest.task}. Intervalo solicitado: {manifest.frameIntervalMs} ms; los FPS reales dependen del equipo. Estado: {manifest.validationStatus === "experimental" ? "experimental, sin validación lingüística" : "validado según su ficha"}. <a href={manifest.sourceUrl} target="_blank" rel="noreferrer">Origen y licencia: {manifest.license}</a>.</p>
          </div>
        </div>
        <section className="camera-settings-block">
          <label className="field-label" htmlFor="landmark-runtime">Motor de landmarks</label>
          <select id="landmark-runtime" className="native-select" aria-describedby="landmark-runtime-help" value={landmarkRuntime.mode}
            disabled={!landmarkRuntime.selectable || continuousCapture || captureStatus === "capturing" || captureStatus === "reviewing" || captureStatus === "processing"}
            onChange={(event) => changeLandmarkMode(event.currentTarget.value as LandmarkRuntimeMode)}>
            <option value="main-thread">Compatible · hilo de la interfaz</option>
            <option value="worker">Worker · experimental</option>
          </select>
          <p id="landmark-runtime-help" className="help-text">Cambia fuera de captura o revisión. Reinicia la medición y conserva el modelo LSB. El diagnóstico muestra el motor real si se usa fallback.</p>
        </section>
        {currentModelReady ? <RecognitionDiagnostics key={`${manifest.id}@${manifest.version}:${landmarkRuntime.mode}`} metrics={metrics} model={manifest} /> : null}
        <label className="setting-row">
          <span><strong>Detectar landmarks en el navegador</strong><small>MediaPipe procesa la pose y las manos localmente; el video no se envía.</small></span>
          <input
            type="checkbox"
            checked={landmarksEnabled}
            onChange={(event) => setLandmarksEnabled(event.currentTarget.checked)}
          />
        </label>
        <p className="help-text">Encuadre sugerido: buena iluminación, manos y torso visibles. La vista previa no se almacena.</p>
      </Dialog>
    </section>
  );
}
