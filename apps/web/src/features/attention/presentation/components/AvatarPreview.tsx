"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Maximize, Pause, Play, Repeat, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import SceneErrorBoundary from "@/features/avatar/SceneErrorBoundary";
import { resolveAnimationClip } from "@/features/lsb-catalog/application/resolve-animation";
import type { LsbExpression } from "@/features/lsb-catalog/domain/lsb-expression";

const MAX_MODEL_SIZE = 25 * 1024 * 1024;
const BUNDLED_AVATAR_URL = "/avatars/signalink_avatar.glb";
const CONFIGURED_MODEL_URL =
  process.env.NEXT_PUBLIC_LSB_AVATAR_MODEL_URL === "off"
    ? null
    : process.env.NEXT_PUBLIC_LSB_AVATAR_MODEL_URL ||
      BUNDLED_AVATAR_URL;
const IS_BUNDLED_MODEL_DISABLED =
  process.env.NEXT_PUBLIC_LSB_AVATAR_MODEL_URL === "off";
const AvatarScene = dynamic(() => import("@/features/avatar/AvatarScene"), {
  ssr: false,
  loading: () => <p className="scene-state">Preparando el modelo 3D…</p>,
});

interface AvatarPreviewProps {
  expression?: LsbExpression | null;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const seconds = Math.floor(value / 1_000);
  return `0:${String(seconds).padStart(2, "0")}`;
}

export function AvatarPreview({ expression }: AvatarPreviewProps = {}) {
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
  const [modelError, setModelError] = useState<{
    expressionId: string | null;
    message: string;
  } | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);

  const resolvedClip = useMemo(
    () => resolveAnimationClip(clips, expression?.animationClipId ?? null),
    [clips, expression?.animationClipId],
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
      expression?.animationClipId &&
      (CONFIGURED_MODEL_URL !== BUNDLED_AVATAR_URL ||
        expression.animationClipId === "HOLA"),
  );
  const isLoadingModel = hasModel && !clipsLoaded && !modelError;

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
        expression?.animationClipId ?? null,
      );
      setClips(names);
      setClipsLoaded(true);
      setModelError(null);
      setIsPlaying(Boolean(nextClip));
      setCurrentTime(0);
      currentTimeRef.current = 0;
    },
    [expression?.animationClipId],
  );
  const handleClipDurations = useCallback((next: Record<string, number>) => {
    // Three.js reports clip durations in seconds; playback state uses milliseconds.
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
    setModelError({
      expressionId: expression?.id ?? null,
      message:
        "No se pudo cargar el modelo 3D. Inténtalo otra vez o selecciona otro GLB.",
    });
  }, [expression?.id]);

  function resetPlaybackState() {
    setClips([]);
    setClipsLoaded(false);
    setDurations({});
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setIsPlaying(false);
    setRestartToken((value) => value + 1);
    setModelError(null);
  }

  function loadConfiguredModel() {
    if (!CONFIGURED_MODEL_URL) return;
    resetPlaybackState();
    setModelUrl(CONFIGURED_MODEL_URL);
    setModelName(
      CONFIGURED_MODEL_URL === BUNDLED_AVATAR_URL
        ? "Avatar demostrativo"
        : "Modelo configurado",
    );
  }

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

  let statusMessage = "Selecciona una expresión del catálogo para buscar su animación.";
  if (activeModelError) {
    statusMessage = activeModelError;
  } else if (expression && !expression.animationClipId) {
    statusMessage = "Esta expresión no tiene una animación LSB registrada.";
  } else if (expression && !hasModel && canLoadConfiguredModel) {
    statusMessage =
      CONFIGURED_MODEL_URL === BUNDLED_AVATAR_URL
        ? "El clip propio de Hola está disponible bajo demanda; el modelo pesa 20.5 MB."
        : "El modelo configurado se carga solo cuando pidas reproducir la expresión.";
  } else if (expression && !hasModel && IS_BUNDLED_MODEL_DISABLED) {
    statusMessage = "El avatar 3D está desactivado en esta instalación.";
  } else if (expression && !hasModel) {
    statusMessage = "No hay una animación disponible para esta expresión. Puedes probar un GLB local.";
  } else if (isLoadingModel) {
    statusMessage = "Cargando el modelo 3D…";
  } else if (hasModel && clips.length === 0) {
    statusMessage = "El modelo no contiene clips de animación.";
  } else if (resolvedClip) {
    statusMessage = `Clip «${resolvedClip}» listo. Sin validación lingüística registrada.`;
  } else if (expression?.animationClipId) {
    statusMessage = `El modelo no incluye el clip «${expression.animationClipId}». Animación pendiente de implementación.`;
  }

  return (
    <section
      className="panel-card avatar-preview-card"
      aria-labelledby="avatar-preview-title"
    >
      <header className="compact-card-heading">
        <div className="inline-title">
          <Play size={17} aria-hidden="true" />
          <h2 id="avatar-preview-title">Vista previa en LSB</h2>
        </div>
        <span className="demo-label">Demostración</span>
      </header>
      <div className="avatar-preview-viewport" ref={previewRef}>
        {modelUrl ? (
          <SceneErrorBoundary key={modelUrl} onError={handleModelError}>
            <AvatarScene
              modelUrl={modelUrl}
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
          <Image
            width={800}
            height={800}
            src="/images/avatar-demo.png"
            alt="Avatar de demostración; esta imagen no representa una seña LSB validada"
            loading="eager"
          />
        )}
        <span className="avatar-demo-warning">
          {resolvedClip || expression?.animationStatus === "provisional"
            ? "Clip sin validación"
            : "Sin animación LSB"}
        </span>
      </div>
      <p
        className="avatar-expression-note"
        role={activeModelError ? "alert" : "status"}
      >
        {statusMessage}
      </p>
      {!hasModel && canLoadConfiguredModel ? (
        <Button
          size="small"
          variant="secondary"
          onClick={loadConfiguredModel}
          disabled={isLoadingModel}
          aria-describedby="avatar-load-help"
        >
          {activeModelError
            ? "Reintentar carga"
            : isLoadingModel
              ? "Cargando avatar…"
              : CONFIGURED_MODEL_URL === BUNDLED_AVATAR_URL
                ? "Ver «Hola» en 3D · 20.5 MB"
                : `Buscar clip «${expression?.spanish ?? ""}»`}
        </Button>
      ) : null}
      <span className="sr-only" id="avatar-load-help">
        {CONFIGURED_MODEL_URL === BUNDLED_AVATAR_URL
          ? "Al activar, se descargará el modelo 3D desde este sitio. La seña Hola es provisional."
          : "El modelo configurado se carga solo cuando lo solicitas."}
      </span>
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
        <span className="playback-time">
          {selectedClip
            ? `${formatTime(currentTime)} / ${formatTime(duration)}`
            : "Sin clip"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => void previewRef.current?.requestFullscreen?.()}
          aria-label="Pantalla completa del avatar"
        >
          <Maximize size={16} aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => inputRef.current?.click()}
          aria-label={
            hasModel
              ? "Cambiar modelo GLB local"
              : "Probar modelo GLB local, máximo 25 MB"
          }
          title={
            hasModel
              ? "Cambiar modelo GLB local"
              : "Probar modelo GLB local, máximo 25 MB"
          }
          aria-describedby="avatar-upload-help"
        >
          <Upload size={15} aria-hidden="true" />
        </Button>
      </div>
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
      {hasModel ? (
        <div className="avatar-model-tools">
          <p className="model-name">Modelo: {modelName || "configurado"}</p>
          {clips.length === 0 ? (
            <p className="help-text">El GLB no contiene animaciones.</p>
          ) : null}
        </div>
      ) : null}
      {fileError ? (
        <p className="field-error" role="alert">
          {fileError}
        </p>
      ) : null}
    </section>
  );
}
