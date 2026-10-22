"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CameraAccessError,
  type CameraErrorCode,
} from "../../application/ports/camera-service";
import { useCameraService } from "../CameraContext";

export type CameraStatus = "idle" | "requesting" | "active" | "error";

export interface UseCameraReturn {
  status: CameraStatus;
  stream: MediaStream | null;
  error: string | null;
  errorCode: CameraErrorCode | null;
  isSupported: boolean;
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

const subscribeToSupport = () => () => undefined;
const getServerSupportSnapshot = () => false;

function getCameraErrorMessage(code: CameraErrorCode): string {
  switch (code) {
    case "not-supported":
      return "Este navegador no permite acceder a la cámara. Puedes continuar con la captura de demostración o escribir la respuesta.";
    case "insecure-context":
      return "La cámara requiere una conexión segura con HTTPS o ejecutarse en localhost.";
    case "not-allowed":
      return "No se autorizó la cámara. Habilita el permiso del sitio o continúa con la captura de demostración.";
    case "not-found":
      return "No se encontró una cámara disponible. Puedes usar la captura de demostración o escribir la respuesta.";
    case "in-use":
      return "Otra aplicación está usando la cámara. Ciérrala e inténtalo de nuevo.";
    case "overconstrained":
      return "La cámara no admite la configuración solicitada. Vuelve a intentarlo.";
    case "unknown":
      return "No se pudo iniciar la cámara. Puedes reintentar o usar la captura de demostración.";
  }
}

export function useCamera(): UseCameraReturn {
  const service = useCameraService();
  const getSupportSnapshot = useCallback(() => service.isSupported(), [service]);
  const isSupported = useSyncExternalStore(
    subscribeToSupport,
    getSupportSnapshot,
    getServerSupportSnapshot,
  );

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<CameraErrorCode | null>(null);

  const mountedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const startInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      startInFlightRef.current = false;
      if (streamRef.current) service.close(streamRef.current);
      streamRef.current = null;
    };
  }, [service]);

  const stop = useCallback(() => {
    requestRef.current += 1;
    startInFlightRef.current = false;
    const currentStream = streamRef.current;
    streamRef.current = null;
    if (currentStream) service.close(currentStream);
    if (!mountedRef.current) return;
    setStream(null);
    setStatus("idle");
    setError(null);
    setErrorCode(null);
  }, [service]);

  const start = useCallback(async () => {
    if (startInFlightRef.current || streamRef.current) return;
    if (!service.isSupported()) {
      setStatus("error");
      setErrorCode("not-supported");
      setError(getCameraErrorMessage("not-supported"));
      return;
    }

    startInFlightRef.current = true;
    const requestId = ++requestRef.current;
    setStatus("requesting");
    setError(null);
    setErrorCode(null);

    try {
      const nextStream = await service.open();
      if (requestId !== requestRef.current || !mountedRef.current) {
        service.close(nextStream);
        return;
      }

      streamRef.current = nextStream;
      setStream(nextStream);
      setStatus("active");

      nextStream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (!mountedRef.current || requestId !== requestRef.current) return;
          if (streamRef.current !== nextStream) return;
          streamRef.current = null;
          setStream(null);
          setStatus("error");
          setErrorCode("unknown");
          setError("La cámara dejó de transmitir. Vuelve a activarla o usa la captura de demostración.");
        }, { once: true });
      });
    } catch (cause) {
      if (requestId !== requestRef.current || !mountedRef.current) return;
      const code = cause instanceof CameraAccessError ? cause.code : "unknown";
      setStatus("error");
      setErrorCode(code);
      setError(getCameraErrorMessage(code));
    } finally {
      if (requestId === requestRef.current) startInFlightRef.current = false;
    }
  }, [service]);

  return {
    status,
    stream,
    error,
    errorCode,
    isSupported,
    isActive: status === "active" && stream !== null,
    start,
    stop,
  };
}
