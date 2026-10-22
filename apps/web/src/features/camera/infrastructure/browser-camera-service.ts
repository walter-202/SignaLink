import {
  CameraAccessError,
  type CameraErrorCode,
  type CameraOpenOptions,
  type CameraService,
} from "../application/ports/camera-service";

function mapCameraError(error: unknown): CameraErrorCode {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
      case "SecurityError":
        return "not-allowed";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "not-found";
      case "NotReadableError":
      case "TrackStartError":
        return "in-use";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "overconstrained";
      default:
        return "unknown";
    }
  }
  return "unknown";
}

export class BrowserCameraService implements CameraService {
  isSupported = (): boolean => typeof navigator !== "undefined"
    && typeof navigator.mediaDevices?.getUserMedia === "function";

  async open(options: CameraOpenOptions = {}): Promise<MediaStream> {
    if (typeof window === "undefined" || !this.isSupported()) {
      throw new CameraAccessError("not-supported");
    }
    if (!window.isSecureContext) {
      throw new CameraAccessError("insecure-context");
    }

    const video: MediaTrackConstraints = {
      facingMode: options.facingMode ?? "user",
    };
    if (options.width) video.width = { ideal: options.width };
    if (options.height) video.height = { ideal: options.height };

    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video });
    } catch (error) {
      const code = mapCameraError(error);
      if (code !== "overconstrained") throw new CameraAccessError(code);

      try {
        return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } catch (fallbackError) {
        throw new CameraAccessError(mapCameraError(fallbackError));
      }
    }
  }

  close(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

export const browserCameraService = new BrowserCameraService();
