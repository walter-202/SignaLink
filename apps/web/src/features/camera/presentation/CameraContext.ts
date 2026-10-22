import { createContext, useContext } from "react";
import type { CameraService } from "../application/ports/camera-service";

export const CameraContext = createContext<CameraService | null>(null);

export function useCameraService(): CameraService {
  const service = useContext(CameraContext);
  if (!service) {
    throw new Error("CameraProvider debe envolver la vista de captura.");
  }
  return service;
}
