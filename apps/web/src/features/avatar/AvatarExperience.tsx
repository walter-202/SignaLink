"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { VoiceInputButton } from "@/features/communication";
import SceneErrorBoundary from "./SceneErrorBoundary";

const AvatarScene = dynamic(() => import("./AvatarScene"), {
  ssr: false,
  loading: () => <p className="scene-state">Preparando el visor 3D…</p>,
});

const MAX_MODEL_SIZE = 25 * 1024 * 1024;
const CONFIGURED_MODEL_URL = process.env.NEXT_PUBLIC_AVATAR_MODEL_URL || null;

export default function AvatarExperience() {
  const [modelUrl, setModelUrl] = useState<string | null>(CONFIGURED_MODEL_URL);
  const [modelName, setModelName] = useState<string | null>(
    CONFIGURED_MODEL_URL ? "Modelo del proyecto" : null,
  );
  const [clips, setClips] = useState<string[]>([]);
  const [selectedClip, setSelectedClip] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [fileError, setFileError] = useState("");
  const [spokenText, setSpokenText] = useState("");
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleAnimationsLoaded = useCallback((names: string[]) => {
    setClips(names);
    setSelectedClip((current) => (names.includes(current) ? current : names[0] ?? ""));
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
    <main className="avatar-page">
      <header className="page-heading">
        <p className="eyebrow">Prototipo interactivo</p>
        <h1>Visor de avatar 3D</h1>
        <p>
          Explora un modelo, carga un archivo GLB desde este dispositivo y prueba
          los clips incluidos en él. El archivo no se envía a ningún servidor.
        </p>
      </header>

      <section className="avatar-workspace" aria-label="Visor y controles del avatar">
        <div
          className="avatar-viewer"
          role="region"
          aria-label="Vista 3D del avatar. Usa mouse o pantalla táctil para girar y acercar."
        >
          <SceneErrorBoundary key={modelUrl ?? "preview"}>
            <AvatarScene
              modelUrl={modelUrl}
              animationName={selectedClip}
              isPlaying={isPlaying}
              isLooping={isLooping}
              speed={speed}
              onAnimationsLoaded={handleAnimationsLoaded}
              onPlaybackEnded={handlePlaybackEnded}
            />
          </SceneErrorBoundary>
          <p className="viewer-hint">Arrastra para girar · rueda o pellizca para acercar</p>
        </div>

        <aside className="avatar-controls" aria-labelledby="controls-title">
          <h2 id="controls-title">Controles</h2>

          <div className="control-field">
            <label htmlFor="avatar-model">Modelo 3D (.glb)</label>
            <input
              className="file-picker"
              id="avatar-model"
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={handleModelSelection}
            />
            <p className="help-text">Máximo 25 MB. La vista inicial usa una figura provisional.</p>
            {modelName ? <p className="model-name">Cargado: {modelName}</p> : null}
            {fileError ? <p className="status-message" role="alert">{fileError}</p> : null}
          </div>

          {modelName ? (
            <button className="secondary-button" type="button" onClick={clearModel}>
              Volver a la figura provisional
            </button>
          ) : null}

          <div className="control-field">
            <label htmlFor="avatar-animation">Animación del modelo</label>
            <select
              id="avatar-animation"
              value={selectedClip}
              disabled={clips.length === 0}
              onChange={(event) => {
                setSelectedClip(event.currentTarget.value);
                setIsPlaying(false);
              }}
            >
              {clips.length === 0 ? <option value="">Sin clips disponibles</option> : null}
              {clips.map((clip) => <option key={clip} value={clip}>{clip}</option>)}
            </select>
            <p className="help-text">
              {modelUrl && clips.length === 0
                ? "El GLB cargado no contiene clips de animación."
                : "Los clips son recursos de prueba; aún requieren validación lingüística para representar LSB."}
            </p>
          </div>

          <div className="control-row">
            <button
              className="primary-button"
              type="button"
              disabled={!selectedClip}
              onClick={() => setIsPlaying((playing) => !playing)}
            >
              {isPlaying ? "Pausar" : "Reproducir"}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!selectedClip}
              onClick={() => setIsPlaying(false)}
            >
              Detener
            </button>
          </div>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={isLooping}
              disabled={!selectedClip}
              onChange={(event) => setIsLooping(event.currentTarget.checked)}
            />
            Repetir animación
          </label>

          <div className="control-field">
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
        </aside>
      </section>

      <section className="voice-card" aria-labelledby="voice-title">
        <div className="voice-heading">
          <div>
            <p className="eyebrow">Entrada experimental</p>
            <h2 id="voice-title">Dictado en español</h2>
          </div>
          <p className="help-text">
            El dictado convierte voz en texto para preparar una futura traducción.
            Aún no genera señas ni controla las animaciones del avatar.
          </p>
        </div>
        <VoiceInputButton onTranscriptComplete={setSpokenText} />
        <div className="control-field">
          <label htmlFor="spoken-text">Texto reconocido</label>
          <textarea
            className="text-input"
            id="spoken-text"
            rows={4}
            value={spokenText}
            onChange={(event) => setSpokenText(event.currentTarget.value)}
            placeholder="Aquí aparecerá el texto dictado; también puedes escribirlo."
          />
        </div>
        <p className="help-text">
          El navegador puede procesar el audio mediante sus propios servicios.
          Revisa sus permisos y privacidad antes de dictar información sensible.
        </p>
      </section>

      <div className="notice-card" role="note">
        <strong>Estado del prototipo:</strong> la figura inicial es geométrica y
        solo sirve para probar el visor. Para usar un avatar riggeado, selecciona
        un GLB autorizado con sus clips de animación. El visor no traduce español
        ni certifica que una animación corresponda a una seña LSB.
      </div>
    </main>
  );
}
