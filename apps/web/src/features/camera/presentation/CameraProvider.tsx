"use client";

import { useMemo, type ReactNode } from "react";
import type { CameraService } from "../application/ports/camera-service";
import { browserCameraService } from "../infrastructure/browser-camera-service";
import { CameraContext } from "./CameraContext";

interface CameraProviderProps {
  children: ReactNode;
  service?: CameraService;
}

export function CameraProvider({ children, service }: CameraProviderProps) {
  const resolvedService = useMemo(
    () => service ?? browserCameraService,
    [service],
  );

  return (
    <CameraContext.Provider value={resolvedService}>
      {children}
    </CameraContext.Provider>
  );
}
