"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import SceneErrorBoundary from "./SceneErrorBoundary";

const AvatarScene = dynamic(() => import("./AvatarScene"), {
  ssr: false,
  loading: () => <p className="scene-state">Preparando el visor 3D…</p>,
});

const MAX_MODEL_SIZE = 25 * 1024 * 1024;
const V5_MODEL_URL = "/avatars/signalink_avatar_v5_refined.glb";
const configuredModelUrl = process.env.NEXT_PUBLIC_AVATAR_MODEL_URL?.trim();
const CONFIGURED_MODEL_URL = configuredModelUrl === "off"
  ? null
  : configuredModelUrl || V5_MODEL_URL;

export default function AvatarExperience() {
  const [modelUrl, setModelUrl] = useState<string | null>(CONFIGURED_MODEL_URL);
  const [modelName, setModelName] = useState<string | null>(
    CONFIGURED_MODEL_URL === V5_MODEL_URL
      ? "SignaLink Avatar V5 · prototipo"
      : CONFIGURED_MODEL_URL ? "Modelo configurado" : null,
  );
  const [seekTime, setSeekTime] = useState(0);
  const [restartToken, setRestartToken] = useState(0);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [clips, setClips] = useState<string[]>([]);
  const [selectedClip, setSelectedClip] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [fileError, setFileError] = useState("");
  const objectUrlRef = useRef<string | null>(null);
  const isBundledV5 = modelUrl === V5_MODEL_URL;

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

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
      setFileError("Selecciona un modelo .glb. Los archivos .gltf externos no están soportados en esta vista local.");
      return;
    }
    if (file.size > MAX_MODEL_SIZE) {
      setFileError("El modelo supera el límite de 25 MB para esta vista previa.");
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setModelUrl(nextUrl);
    setModelName(file.name);
    setClips([]);
    setSelectedClip("");
    setIsPlaying(false);
    setFileError("");
  }

  function clearModel() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setModelUrl(null);
    setModelName(null);
    setClips([]);
    setSelectedClip("");
    setIsPlaying(false);
    setFileError("");
  }

  return (
    <main className="avatar-page avatar-lab-page">
      <header className="page-heading avatar-lab-heading">
        <div>
          <p className="eyebrow">Prototipo técnico · V5.1</p>
          <h1>Laboratorio de avatar 3D</h1>
          <p>Revisa el encuadre frontal, la malla y las animaciones del rig en el navegador.</p>
        </div>
        <span className="avatar-lab-status-badge">QA de rig · no LSB validado</span>
      </header>

      <section className="avatar-lab-layout" aria-label="Prueba técnica del avatar">
        <div
          className="avatar-viewer"
          role="region"
          aria-label="Vista frontal fija del avatar 3D"
          data-testid="avatar-lab-viewer"
        >
          <SceneErrorBoundary key={modelUrl ?? "preview"}>
            <AvatarScene
              modelUrl={modelUrl}
              animationName={selectedClip}
              isPlaying={isPlaying}
              isLooping={isLooping}
              speed={speed}
              restartToken={restartToken}
              seekTime={seekTime}
              onClipDurations={setDurations}
              autoFrame
              onAnimationsLoaded={handleAnimationsLoaded}
              onPlaybackEnded={handlePlaybackEnded}
            />
          </SceneErrorBoundary>
          <span className="avatar-viewer-label">
            {isBundledV5 ? "V5 · rig glTF" : modelName ?? "Figura provisional"}
          </span>
          <p className="viewer-hint">Cámara fija de frente · sin rotación espacial</p>
        </div>

        <aside className="avatar-controls avatar-lab-controls" aria-labelledby="avatar-lab-controls-title">
          <div className="avatar-lab-panel-heading">
            <div>
              <p className="eyebrow">Inspección local</p>
              <h2 id="avatar-lab-controls-title">Controles del rig</h2>
            </div>
            <span className="avatar-lab-clip-count">{clips.length} clips</span>
          </div>

          <div className="avatar-lab-note" role="note">
            <strong>Prototipo, no traductor</strong>
            <p>17 clips prueban el rig; tres estudian las posturas A, B y L de la lámina dactilológica. «HOLA» adapta el clip propio. Todas requieren revisión lingüística LSB.</p>
          </div>

          <div className="control-field">
            <label htmlFor="avatar-model">Modelo 3D (.glb)</label>
            <input
              className="file-picker"
              id="avatar-model"
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={handleModelSelection}
            />
            <p className="help-text">Solo lectura local en el navegador. Máximo 25 MB.</p>
            {modelName ? <p className="model-name">Cargado: {modelName}</p> : null}
            {fileError ? <p className="status-message" role="alert">{fileError}</p> : null}
          </div>

          {modelUrl ? (
            <button className="secondary-button avatar-lab-reset" type="button" onClick={clearModel}>
              Usar figura provisional
            </button>
          ) : null}

          <div className="control-field">
            <label htmlFor="avatar-animation">Clip técnico</label>
            <select
              id="avatar-animation"
              value={selectedClip}
              disabled={clips.length === 0}
              onChange={(event) => {
                setSelectedClip(event.currentTarget.value);
                setSeekTime(0);
                setIsPlaying(false);
              }}
            >
              {clips.length === 0 ? <option value="">Sin clips disponibles</option> : null}
              {clips.map((clip) => <option key={clip} value={clip}>{clip === "HOLA" ? "HOLA · catálogo, provisional" : clip.startsWith("QA_DACTILO_") ? `${clip.slice(-1)} · estudio dactilológico provisional` : clip}</option>)}
            </select>
            <p className="help-text">La selección no confirma que el movimiento corresponda a una seña.</p>
          </div>

          <div className="avatar-lab-playback">
            <button
              className="primary-button"
              type="button"
              disabled={!selectedClip}
              onClick={() => setIsPlaying((playing) => !playing)}
            >
              {isPlaying ? "Pausar clip" : "Reproducir clip"}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!selectedClip}
              onClick={() => { setIsPlaying(false); setSeekTime(0); setRestartToken((value) => value + 1); }}
            >
              Detener
            </button>
          </div>

          <div className="control-field">
            <label htmlFor="avatar-seek">Fotograma de inspección: {seekTime.toFixed(2)} s</label>
            <input id="avatar-seek" type="range" className="range-control" min="0" max={durations[selectedClip] ?? 0} step="0.01" value={seekTime} disabled={!selectedClip} onChange={(event) => { setIsPlaying(false); setSeekTime(Number(event.currentTarget.value)); }} />
            <p className="help-text">Pausa y examina cabeza, manos y codos en cualquier punto del clip.</p>
          </div>

          <label className="toggle-row avatar-lab-toggle">
            <input
              type="checkbox"
              checked={isLooping}
              disabled={!selectedClip}
              onChange={(event) => setIsLooping(event.currentTarget.checked)}
            />
            Repetir clip
          </label>

          <div className="control-field avatar-lab-speed">
            <label htmlFor="avatar-speed">Velocidad: {speed.toFixed(1)}×</label>
            <input
              className="range-control"
              id="avatar-speed"
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={speed}
              disabled={!selectedClip}
              onChange={(event) => setSpeed(Number(event.currentTarget.value))}
            />
          </div>

          {isBundledV5 ? (
            <dl className="avatar-lab-facts" aria-label="Ficha del modelo V5">
              <div><dt>Rig</dt><dd>43 articulaciones · 1 skin</dd></div>
              <div><dt>Clips técnicos</dt><dd>17 técnicos + 4 estudios provisionales</dd></div>
              <div><dt>Archivo</dt><dd>6.99 MB</dd></div>
              <div><dt>Estado</dt><dd>Revisión requerida</dd></div>
            </dl>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
