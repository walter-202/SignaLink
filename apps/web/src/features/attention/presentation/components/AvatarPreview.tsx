"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Hand, Maximize, Pause, Play, Repeat, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import SceneErrorBoundary from "@/features/avatar/SceneErrorBoundary";
import { resolveAnimationClip } from "@/features/lsb-catalog/application/resolve-animation";
import type { LsbExpression } from "@/features/lsb-catalog/domain/lsb-expression";
import { AvatarClipCatalog, type AvatarCatalogSelection } from "./AvatarClipCatalog";

const MAX_MODEL_SIZE = 25 * 1024 * 1024;
const BUNDLED_AVATAR_URL = "/avatars/signalink_avatar_v5_refined.glb";
const CONFIGURED_MODEL_URL =
  process.env.NEXT_PUBLIC_LSB_AVATAR_MODEL_URL === "off"
    ? null
    : process.env.NEXT_PUBLIC_LSB_AVATAR_MODEL_URL || BUNDLED_AVATAR_URL;
const IS_BUNDLED_MODEL_DISABLED =
  process.env.NEXT_PUBLIC_LSB_AVATAR_MODEL_URL === "off";
const AvatarScene = dynamic(() => import("@/features/avatar/AvatarScene"), {
  ssr: false,
  loading: () => <p className="scene-state">Preparando el modelo 3D…</p>,
});

interface AvatarPreviewProps {
  expression?: LsbExpression | null;
  isDraftMatch?: boolean;
  autoStart?: boolean;
  onClipsLoaded?: (clips: readonly string[] | null) => void;
  /**
   * Catalog controls rendered inside this card. When present, the card hides
   * its own summary because the catalog already names the selected expression.
   */
  catalog?: ReactNode;
  /** Catalog rendered inside the 3D dialog so expressions can be changed there. */
  dialogCatalog?: ReactNode;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const totalSeconds = Math.floor(value / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ":" + String(seconds).padStart(2, "0");
}

export function AvatarPreview({
  expression,
  isDraftMatch = false,
  autoStart = false,
  onClipsLoaded,
  catalog,
  dialogCatalog,
}: AvatarPreviewProps = {}) {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelName, setModelName] = useState("");
  const [clips, setClips] = useState<string[]>([]);
  const [clipsLoaded, setClipsLoaded] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [restartToken, setRestartToken] = useState(0);
  const [fileError, setFileError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catalogSelection, setCatalogSelection] = useState<AvatarCatalogSelection | null>(null);
  const [modelError, setModelError] = useState<{
    expressionId: string | null;
    message: string;
  } | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const autoStartedExpressionRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);

  const activeClipId = catalogSelection?.clipId ?? (catalogSelection ? null : expression?.animationClipId ?? null);
  const resolvedClip = useMemo(
    () => resolveAnimationClip(clips, activeClipId),
    [clips, activeClipId],
  );
  const selectedClip = resolvedClip ?? "";
  const duration = resolvedClip ? (durations[resolvedClip] ?? 0) : 0;
  const hasModel = Boolean(modelUrl);
  const activeModelError =
    modelError?.expressionId === (expression?.id ?? null)
      ? modelError.message
      : "";
  const canLoadConfiguredModel = Boolean(
    CONFIGURED_MODEL_URL &&
      activeClipId &&
      (CONFIGURED_MODEL_URL !== BUNDLED_AVATAR_URL ||
        activeClipId === "HOLA" || activeClipId.startsWith("QA_DACTILO_")),
  );
  const isLoadingModel = hasModel && !clipsLoaded && !modelError;

  const resetPlaybackState = useCallback(() => {
    setClips([]);
    setClipsLoaded(false);
    setDurations({});
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setIsPlaying(false);
    setRestartToken((value) => value + 1);
    setModelError(null);
    onClipsLoaded?.(null);
  }, [onClipsLoaded]);

  const loadConfiguredModel = useCallback(() => {
    if (!CONFIGURED_MODEL_URL) return;
    resetPlaybackState();
    setModelUrl(CONFIGURED_MODEL_URL);
    setModelName(
      CONFIGURED_MODEL_URL === BUNDLED_AVATAR_URL
        ? "Avatar demostrativo"
        : "Modelo configurado",
    );
  }, [resetPlaybackState]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || !selectedClip || duration <= 0) return;
    const startedAt = Date.now() - currentTimeRef.current;
    const timer = window.setInterval(() => {
      const next = Math.min(Date.now() - startedAt, duration);
      currentTimeRef.current = next;
      setCurrentTime(next);
    }, 120);
    return () => window.clearInterval(timer);
  }, [isPlaying, selectedClip, duration]);

  const handleAnimationsLoaded = useCallback(
    (names: string[]) => {
      const nextClip = resolveAnimationClip(
        names,
        activeClipId,
      );
      setClips(names);
      setClipsLoaded(true);
      setModelError(null);
      onClipsLoaded?.(names);
      setIsPlaying(Boolean(nextClip));
      setCurrentTime(0);
      currentTimeRef.current = 0;
    },
    [activeClipId, onClipsLoaded],
  );

  const handleClipDurations = useCallback((next: Record<string, number>) => {
    setDurations(
      Object.fromEntries(
        Object.entries(next).map(([name, seconds]) => [
          name,
          Math.round(seconds * 1_000),
        ]),
      ),
    );
  }, []);

  const handlePlaybackEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(duration);
    currentTimeRef.current = duration;
  }, [duration]);

  const handleModelError = useCallback(() => {
    setModelUrl(null);
    setModelName("");
    setClips([]);
    setClipsLoaded(false);
    setDurations({});
    setIsPlaying(false);
    onClipsLoaded?.(null);
    setModelError({
      expressionId: expression?.id ?? null,
      message:
        "No se pudo cargar el modelo 3D. Inténtalo otra vez o selecciona otro GLB.",
    });
  }, [expression?.id, onClipsLoaded]);

  function handleModelSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setFileError("Selecciona un archivo .glb para probarlo localmente.");
      return;
    }
    if (file.size > MAX_MODEL_SIZE) {
      setFileError("El archivo supera el límite de 25 MB.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    resetPlaybackState();
    setModelUrl(nextUrl);
    setModelName(file.name);
    setFileError("");
  }

  function togglePlayback() {
    if (!selectedClip) return;
    if (currentTimeRef.current >= duration) {
      setCurrentTime(0);
      currentTimeRef.current = 0;
      setRestartToken((value) => value + 1);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((playing) => !playing);
  }

  function stopPlayback() {
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setRestartToken((value) => value + 1);
  }

  function selectCatalogItem(selection: AvatarCatalogSelection) {
    setCatalogSelection(selection);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setRestartToken((value) => value + 1);
    const found = resolveAnimationClip(clips, selection.clipId);
    setIsPlaying(Boolean(found));
    if (!modelUrl && CONFIGURED_MODEL_URL && (CONFIGURED_MODEL_URL !== BUNDLED_AVATAR_URL || selection.availableInBundledModel)) {
      loadConfiguredModel();
    }
  }

  function openPreview() {
    if (!modelUrl && canLoadConfiguredModel) loadConfiguredModel();
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!autoStart || !expression?.id) {
      autoStartedExpressionRef.current = null;
      return;
    }
    if (
      !canLoadConfiguredModel ||
      autoStartedExpressionRef.current === expression.id
    ) {
      return;
    }
    autoStartedExpressionRef.current = expression.id;
    loadConfiguredModel();
    setDialogOpen(true);
  }, [autoStart, canLoadConfiguredModel, expression?.id, loadConfiguredModel]);

  useEffect(() => {
    if (!dialogOpen || !canLoadConfiguredModel || hasModel || activeModelError) {
      return;
    }
    // The shared catalog can select an expression after the modal is open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfiguredModel();
  }, [activeModelError, canLoadConfiguredModel, dialogOpen, hasModel, loadConfiguredModel]);

  let statusMessage =
    "Escribe una expresión exacta del catálogo o selecciónala para revisar su clip.";
  if (activeModelError) {
    statusMessage = activeModelError;
  } else if (expression && !expression.animationClipId) {
    statusMessage = "Esta expresión no tiene una animación LSB registrada.";
  } else if (expression && !hasModel && canLoadConfiguredModel) {
    statusMessage =
      CONFIGURED_MODEL_URL === BUNDLED_AVATAR_URL
        ? (isDraftMatch ? "Coincidencia exacta: «Hola»." : "Clip de «Hola» disponible.") +
          " El modelo se carga bajo demanda (6.98 MB)."
        : (isDraftMatch
            ? "Coincidencia exacta del catálogo."
            : "Expresión seleccionada del catálogo.") +
          " El modelo se cargará para buscar el clip asociado.";
  } else if (expression && !hasModel && IS_BUNDLED_MODEL_DISABLED) {
    statusMessage = "El avatar 3D está desactivado en esta instalación.";
  } else if (expression && !hasModel) {
    statusMessage =
      "No hay un modelo configurado con este clip. Puedes probar un GLB local.";
  } else if (isLoadingModel) {
    statusMessage = "Cargando el modelo 3D…";
  } else if (hasModel && clips.length === 0) {
    statusMessage = "El modelo no contiene clips de animación.";
  } else if (resolvedClip) {
    statusMessage =
      "Clip «" +
      resolvedClip +
      "» listo. Es una demostración sin validación lingüística.";
  } else if (expression?.animationClipId) {
    statusMessage =
      "El modelo no incluye el clip «" +
      expression.animationClipId +
      "». Animación pendiente de implementación.";
  }

  const showStatusNote =
    !catalog || Boolean(expression) || Boolean(activeModelError);

  return (
    <section
      className={
        "panel-card avatar-preview-card" +
        (catalog ? " avatar-preview-card--integrated" : "")
      }
      aria-labelledby="avatar-preview-title"
    >
      <header className="compact-card-heading">
        <div className="inline-title">
          <Hand size={17} aria-hidden="true" />
          <h2 id="avatar-preview-title">Vista 3D de respuesta</h2>
        </div>
        <span className="demo-label">
          {expression?.animationStatus === "provisional"
            ? "Provisional"
            : "Sin traducción"}
        </span>
      </header>
      {catalog ? (
        <div className="avatar-preview-catalog">{catalog}</div>
      ) : (
        <div className="avatar-preview-summary">
          <span className="avatar-summary-icon" aria-hidden="true">
            <Play size={17} />
          </span>
          <div className="avatar-summary-copy">
            <span className="field-label">
              {isDraftMatch
                ? "Coincidencia exacta del borrador"
                : expression
                  ? "Expresión seleccionada"
                  : "Coincidencia del borrador"}
            </span>
            <strong>
              {expression
                ? "«" + expression.spanish + "»"
                : "Sin coincidencia exacta"}
            </strong>
            <span>
              {expression?.animationStatus === "provisional"
                ? "Clip disponible · requiere revisión lingüística"
                : expression
                  ? "Expresión documentada; su clip 3D no está disponible."
                  : "La respuesta solo se anima si coincide con el catálogo."}
            </span>
          </div>
        </div>
      )}
      <div className="avatar-preview-action">
        {showStatusNote ? (
          <p
            className="avatar-expression-note"
            role={activeModelError ? "alert" : "status"}
          >
            {statusMessage}
          </p>
        ) : null}
        <Button
          size="small"
          variant="secondary"
          onClick={openPreview}
          aria-describedby="avatar-load-help"
        >
          {isLoadingModel ? "Cargando avatar…" : "Abrir escena 3D"}
        </Button>
      </div>
      <span className="sr-only" id="avatar-load-help">
        El modelo se procesa en este navegador y el clip solo se reproduce si el
        modelo lo contiene. Las animaciones no tienen validación lingüística.
      </span>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setCatalogSelection(null); }}
        title="Vista 3D de respuesta"
        description={
          expression
            ? (isDraftMatch ? "Coincidencia exacta: " : "Expresión seleccionada: ") +
              "«" +
              expression.spanish +
              "». El clip solo se reproduce si el modelo lo contiene."
            : "Selecciona una expresión del catálogo para revisar su clip."
        }
        className="avatar-dialog-content"
      >
        <div className="avatar-modal-layout">
          <div className="avatar-modal-content">
          <div
            className="avatar-preview-viewport avatar-modal-scene"
            ref={sceneRef}
          >
            {modelUrl ? (
              <SceneErrorBoundary key={modelUrl} onError={handleModelError}>
                <AvatarScene
                  modelUrl={modelUrl}
                  autoFrame={modelUrl === BUNDLED_AVATAR_URL}
                  animationName={selectedClip}
                  isPlaying={isPlaying}
                  isLooping={isLooping}
                  speed={1}
                  restartToken={restartToken}
                  onAnimationsLoaded={handleAnimationsLoaded}
                  onClipDurations={handleClipDurations}
                  onPlaybackEnded={handlePlaybackEnded}
                />
              </SceneErrorBoundary>
            ) : (
              <div className="avatar-scene-empty">
                <span className="avatar-summary-icon" aria-hidden="true">
                  <Hand size={22} />
                </span>
                <strong>
                  {expression
                    ? "Todavía no hay un clip reproducible."
                    : "No hay un modelo 3D cargado."}
                </strong>
                <p>{statusMessage}</p>
                {canLoadConfiguredModel ? (
                  <Button
                    size="small"
                    variant="primary"
                    onClick={loadConfiguredModel}
                  >
                    Cargar modelo configurado
                  </Button>
                ) : null}
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => inputRef.current?.click()}
                >
                  Probar un modelo GLB local
                </Button>
              </div>
            )}
          </div>
          <div className="avatar-modal-toolbar">
            <div className="avatar-playback-controls">
              <Button
                size="icon"
                variant="ghost"
                onClick={togglePlayback}
                disabled={!selectedClip}
                aria-label={
                  isPlaying ? "Pausar animación LSB" : "Reproducir animación LSB"
                }
              >
                {isPlaying ? (
                  <Pause size={17} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Play size={17} fill="currentColor" aria-hidden="true" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={stopPlayback}
                disabled={!selectedClip}
                aria-label="Detener animación LSB"
              >
                <Square size={15} fill="currentColor" aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsLooping((looping) => !looping)}
                disabled={!selectedClip}
                aria-label="Repetir animación LSB"
                aria-pressed={isLooping}
              >
                <Repeat size={16} aria-hidden="true" />
              </Button>
              <span className="playback-time" aria-live="off">
                {selectedClip
                  ? formatTime(currentTime) + " / " + formatTime(duration)
                  : "Sin clip"}
              </span>
            </div>
            <div className="avatar-modal-actions">
              <span className="model-name">
                Modelo: {modelName || "sin seleccionar"}
              </span>
              <Button
                size="small"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                aria-label={
                  hasModel ? "Cambiar modelo GLB local" : "Probar modelo GLB local"
                }
                aria-describedby="avatar-upload-help"
              >
                <Upload size={15} aria-hidden="true" />
                {hasModel ? "Cambiar modelo" : "Cargar GLB"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => void sceneRef.current?.requestFullscreen?.()}
                aria-label="Pantalla completa del avatar"
              >
                <Maximize size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
          <p
            className="avatar-modal-status"
            role={activeModelError ? "alert" : "status"}
          >
            {catalogSelection
              ? resolvedClip
                ? `${catalogSelection.label}: clip provisional disponible; requiere revisión lingüística.`
                : isLoadingModel ? "Cargando el modelo 3D…" : `${catalogSelection.label}: no hay clip disponible en este modelo.`
              : statusMessage}
          </p>
          {fileError ? (
            <p className="field-error" role="alert">
              {fileError}
            </p>
          ) : null}
          {hasModel && clips.length === 0 && clipsLoaded ? (
            <p className="help-text">El GLB cargó, pero no contiene animaciones.</p>
          ) : null}
          </div>
          <aside className="avatar-modal-catalog" aria-label="Catálogo LSB">
            {dialogCatalog ? (
              <div onSubmitCapture={() => setCatalogSelection(null)} onClickCapture={(event) => {
                if ((event.target as HTMLElement).closest("button")) setCatalogSelection(null);
              }}>{dialogCatalog}</div>
            ) : null}
            <AvatarClipCatalog clips={clipsLoaded ? clips : null} selectedClipId={activeClipId} onSelect={selectCatalogItem} studyOnly={Boolean(dialogCatalog)} />
          </aside>
        </div>
      </Dialog>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".glb,model/gltf-binary"
        onChange={handleModelSelection}
        aria-label="Seleccionar modelo 3D GLB"
        aria-describedby="avatar-upload-help"
      />
      <span className="sr-only" id="avatar-upload-help">
        El modelo se procesa solo en este navegador. El archivo debe ser .glb y
        pesar hasta 25 MB.
      </span>
    </section>
  );
}
