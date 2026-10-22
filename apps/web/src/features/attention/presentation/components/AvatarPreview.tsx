"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Maximize, Pause, Play, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

const MAX_MODEL_SIZE = 25 * 1024 * 1024;
const DEMO_DURATION_MS = 8_000;
const AvatarScene = dynamic(() => import("@/features/avatar/AvatarScene"), {
  ssr: false,
  loading: () => <p className="scene-state">Preparando el modelo 3D…</p>,
});

export function AvatarPreview() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelName, setModelName] = useState("");
  const [clips, setClips] = useState<string[]>([]);
  const [selectedClip, setSelectedClip] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [fileError, setFileError] = useState("");
  const objectUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const startedAt = Date.now() - currentTime;
    const progressTimer = window.setInterval(() => {
      setCurrentTime(Math.min(Date.now() - startedAt, DEMO_DURATION_MS));
    }, 120);
    const stopTimer = window.setTimeout(() => {
      setIsPlaying(false);
      setCurrentTime(0);
    }, Math.max(0, DEMO_DURATION_MS - currentTime));
    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(stopTimer);
    };
  }, [currentTime, isPlaying]);

  const handleAnimationsLoaded = useCallback((names: string[]) => {
    setClips(names);
    setSelectedClip((current) => names.includes(current) ? current : names[0] ?? "");
    setIsPlaying(false);
  }, []);
  const handlePlaybackEnded = useCallback(() => setIsPlaying(false), []);

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
    setModelUrl(nextUrl);
    setModelName(file.name);
    setClips([]);
    setSelectedClip("");
    setCurrentTime(0);
    setIsPlaying(false);
    setFileError("");
  }

  function togglePlayback() {
    if (currentTime >= DEMO_DURATION_MS) setCurrentTime(0);
    setIsPlaying((playing) => !playing);
  }

  function formatTime(value: number): string {
    const seconds = Math.floor(value / 1_000);
    return `0:${String(seconds).padStart(2, "0")}`;
  }

  return (
    <section className="panel-card avatar-preview-card" aria-labelledby="avatar-preview-title">
      <header className="compact-card-heading">
        <div className="inline-title"><Play size={17} aria-hidden="true" /><h2 id="avatar-preview-title">Vista previa en LSB</h2></div>
        <span className="demo-label">Demostración</span>
      </header>
      <div className="avatar-preview-viewport" ref={previewRef}>
        {modelUrl ? (
          <AvatarScene
            modelUrl={modelUrl}
            animationName={selectedClip}
            isPlaying={isPlaying}
            isLooping
            speed={1}
            onAnimationsLoaded={handleAnimationsLoaded}
            onPlaybackEnded={handlePlaybackEnded}
          />
        ) : (
          <Image
            width={800}
            height={800}
            src="/images/avatar-demo.png"
            alt="Avatar 3D de demostración en una pose neutra; la imagen no muestra una seña LSB validada"
          />
        )}
        <span className="avatar-demo-warning">Sin seña validada</span>
      </div>
      <div className="avatar-playback-controls">
        <Button size="icon" variant="ghost" onClick={togglePlayback} aria-label={isPlaying ? "Pausar demostración" : "Reproducir demostración"}>
          {isPlaying ? <Pause size={17} fill="currentColor" aria-hidden="true" /> : <Play size={17} fill="currentColor" aria-hidden="true" />}
        </Button>
        <span className="playback-time">{formatTime(currentTime)}</span>
        <input
          className="playback-seek"
          type="range"
          min="0"
          max={DEMO_DURATION_MS}
          step="200"
          value={currentTime}
          onChange={(event) => setCurrentTime(Number(event.currentTarget.value))}
          aria-label="Posición de la reproducción de demostración"
        />
        <span className="playback-time">0:08</span>
        <Button size="icon" variant="ghost" onClick={() => void previewRef.current?.requestFullscreen?.()} aria-label="Pantalla completa del avatar">
          <Maximize size={16} aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => inputRef.current?.click()}
          aria-label={modelUrl ? "Cambiar modelo GLB local" : "Probar modelo GLB local, máximo 25 MB"}
          title={modelUrl ? "Cambiar modelo GLB local" : "Probar modelo GLB local, máximo 25 MB"}
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
      <span className="sr-only" id="avatar-upload-help">El modelo se procesa solo en este navegador. El archivo debe ser .glb y pesar hasta 25 MB.</span>
      {modelUrl ? (
        <div className="avatar-model-tools">
          <label className="field-label" htmlFor="avatar-animation">Animación del modelo</label>
          <select id="avatar-animation" className="native-select" value={selectedClip} disabled={clips.length === 0} onChange={(event) => setSelectedClip(event.currentTarget.value)}>
            {clips.length ? clips.map((clip) => <option key={clip} value={clip}>{clip}</option>) : <option value="">Sin clips disponibles</option>}
          </select>
          {clips.length === 0 ? <p className="help-text">El GLB no contiene animaciones. Puedes girar el modelo con mouse o pantalla táctil.</p> : null}
          <p className="model-name">Modelo local: {modelName}</p>
        </div>
      ) : null}
      {fileError ? <p className="field-error" role="alert">{fileError}</p> : null}
    </section>
  );
}
