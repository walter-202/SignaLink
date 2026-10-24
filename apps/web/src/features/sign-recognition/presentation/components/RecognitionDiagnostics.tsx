"use client";

import { useState } from "react";
import type { SignModelManifest } from "../../domain/sign-model";
import { Button } from "@/components/ui/Button";
import type { RecognitionPerformance, RecognitionTiming } from "../../application/recognition-performance";

const labels: Partial<Record<RecognitionTiming, string>> = {
  modelLoadMs: "Carga del clasificador",
  modelDownloadMs: "Lectura del archivo ONNX",
  modelIntegrityMs: "Verificación SHA-256",
  modelSessionMs: "Inicialización ONNX",
  landmarkLoadMs: "Carga de landmarks",
  landmarkMs: "Detección por fotograma",
  featuresMs: "Extracción de características",
  observationMs: "Ventana observada",
  queueMs: "Espera de clasificación",
  inferenceMs: "Clasificación ONNX",
  segmentToPredictionMs: "Inicio de segmento → predicción",
};

export function RecognitionDiagnostics({ metrics, model }: { metrics: RecognitionPerformance; model: SignModelManifest }) {
  const [snapshot, setSnapshot] = useState(() => metrics.snapshot());

  function download() {
    const report = {
      modelId: model.id, modelVersion: model.version, modelSha256: model.sha256,
      featureSchema: model.featureSchema, inputShape: model.inputShape,
      runtime: model.runtime, ...metrics.snapshot(),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "signalink-rendimiento.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="camera-settings-block" aria-label="Diagnóstico local de reconocimiento">
      <strong>Rendimiento de esta sesión</strong>
      <p className="help-text">
        {snapshot.processedFps === null ? "Sin fotogramas medidos." : `${snapshot.processedFps.toFixed(1)} FPS procesados.`}
        {" "}Últimas 120 muestras por etapa. El tiempo de segmento es aproximado y no mide la duración lingüística de una seña ni la confirmación humana.
      </p>
      <dl className="procedure-facts">
        {Object.entries(labels).map(([name, label]) => {
          const timing = snapshot.timings[name as RecognitionTiming];
          return timing ? <div key={name}><dt>{label}</dt><dd>{Math.round(timing.p50)} / {Math.round(timing.p95)} ms</dd></div> : null;
        })}
      </dl>
      <p className="help-text">Valores: mediana / percentil 95. Propuestas sobre el umbral: {snapshot.counters.accepted ?? 0}; inciertas: {snapshot.counters.uncertain ?? 0}; descartes por saturación o atraso: {(snapshot.counters.overloaded ?? 0) + (snapshot.counters.stale ?? 0)}.</p>
      <div className="composer-tools">
        <Button variant="secondary" size="small" onClick={() => setSnapshot(metrics.snapshot())}>Actualizar medición</Button>
        <Button variant="secondary" size="small" onClick={download}>Exportar diagnóstico</Button>
        <Button variant="ghost" size="small" onClick={() => { metrics.reset(); setSnapshot(metrics.snapshot()); }}>Reiniciar medición</Button>
      </div>
      <p className="help-text">Solo tiempos y contadores en memoria. No incluye imágenes, landmarks, etiquetas, mensajes ni datos de la atención. Se descarga únicamente si lo solicitas.</p>
    </section>
  );
}
