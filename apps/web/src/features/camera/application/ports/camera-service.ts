export type CameraErrorCode =
  | "not-supported"
  | "insecure-context"
  | "not-allowed"
  | "not-found"
  | "in-use"
  | "overconstrained"
  | "unknown";

export interface CameraOpenOptions {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}

export class CameraAccessError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode) {
    super(code);
    this.name = "CameraAccessError";
    this.code = code;
  }
}

/** Port for browser, local, or remote camera adapters. */
export interface CameraService {
  isSupported: () => boolean;
  open: (options?: CameraOpenOptions) => Promise<MediaStream>;
  close: (stream: MediaStream | null) => void;
}
