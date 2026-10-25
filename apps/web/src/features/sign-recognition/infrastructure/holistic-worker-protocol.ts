import type { HolisticResultLike } from "./mediapipe-holistic-landmark-detector";

export type HolisticWorkerRequest =
  | { type: "initialize"; wasmPath: string; modelBuffer: ArrayBuffer }
  | { type: "detect"; id: number; bitmap: ImageBitmap; timestampMs: number };

export type HolisticWorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "result"; id: number; timestampMs: number; result: HolisticResultLike; workerMs: number }
  | { type: "error"; id?: number; code: "model-load" | "inference" };
