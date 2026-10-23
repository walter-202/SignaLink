import {
  LSB_FEATURE_COUNT,
  LSB_SEQUENCE_LENGTH,
} from "../domain/landmarks";
import {
  LSB_REFERENCE_LABELS,
  LSB_REFERENCE_V4,
} from "../domain/model-catalog";
import type {
  SignClassification,
  SignClassifier,
} from "../application/ports/sign-classifier";

const WASM_ROOT = "/onnxruntime/wasm/";

export function selectTopClass(
  logits: ArrayLike<number>,
  labels: readonly string[] = LSB_REFERENCE_LABELS,
): SignClassification {
  if (logits.length !== labels.length || logits.length === 0) {
    throw new Error(`El modelo devolvió ${logits.length} valores; se esperaban ${labels.length}.`);
  }

  let classIndex = 0;
  let maxLogit = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < logits.length; index += 1) {
    const logit = logits[index] ?? Number.NEGATIVE_INFINITY;
    if (!Number.isFinite(logit)) continue;
    if (logit > maxLogit) {
      maxLogit = logit;
      classIndex = index;
    }
  }
  if (!Number.isFinite(maxLogit)) throw new Error("El modelo devolvió una predicción no válida.");

  let denominator = 0;
  for (let index = 0; index < logits.length; index += 1) {
    const logit = logits[index] ?? Number.NEGATIVE_INFINITY;
    if (Number.isFinite(logit)) denominator += Math.exp(logit - maxLogit);
  }
  const confidence = 1 / denominator;

  return { label: labels[classIndex] ?? "", classIndex, confidence };
}

export class OnnxLsbReferenceClassifier implements SignClassifier {
  private session: import("onnxruntime-web/wasm").InferenceSession | null = null;
  private runtime: typeof import("onnxruntime-web/wasm") | null = null;
  private closed = false;

  async initialize(onStage?: (message: string) => void): Promise<void> {
    if (this.session) return;
    this.closed = false;
    onStage?.("Preparando el motor de inferencia local…");
    const runtime = await import("onnxruntime-web/wasm");
    if (this.closed) return;
    runtime.env.wasm.wasmPaths = {
      wasm: `${WASM_ROOT}ort-wasm-simd-threaded.wasm`,
      mjs: `${WASM_ROOT}ort-wasm-simd-threaded.mjs`,
    };
    runtime.env.wasm.numThreads = 1;
    this.runtime = runtime;

    onStage?.(`Descargando el modelo (${(LSB_REFERENCE_V4.modelBytes / (1024 * 1024)).toFixed(1)} MiB)…`);
    const response = await fetch(LSB_REFERENCE_V4.modelUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error(`No se pudo descargar el modelo (${response.status}).`);
    const modelBytes = new Uint8Array(await response.arrayBuffer());
    if (this.closed) return;
    const digest = await crypto.subtle.digest("SHA-256", modelBytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (sha256 !== LSB_REFERENCE_V4.sha256) throw new Error("El archivo del modelo no coincide con su hash SHA-256.");

    onStage?.("Inicializando el modelo LSB en este dispositivo…");
    const session = await runtime.InferenceSession.create(modelBytes, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    if (this.closed) {
      await session.release();
      return;
    }
    if (!session.inputNames.includes(LSB_REFERENCE_V4.inputName)) {
      await session.release();
      throw new Error(`El modelo no contiene la entrada esperada “${LSB_REFERENCE_V4.inputName}”.`);
    }
    this.session = session;
    this.runtime = runtime;
  }

  async classify(sequence: readonly Float32Array[]): Promise<SignClassification> {
    const session = this.session;
    const runtime = this.runtime;
    if (!session || !runtime) throw new Error("El modelo LSB todavía no está cargado.");
    if (sequence.length !== LSB_SEQUENCE_LENGTH) {
      throw new Error(`La captura necesita ${LSB_SEQUENCE_LENGTH} fotogramas.`);
    }

    const input = new Float32Array(LSB_SEQUENCE_LENGTH * LSB_FEATURE_COUNT);
    sequence.forEach((frame, frameIndex) => {
      if (frame.length !== LSB_FEATURE_COUNT) {
        throw new Error(`El fotograma ${frameIndex + 1} no contiene ${LSB_FEATURE_COUNT} características.`);
      }
      input.set(frame, frameIndex * LSB_FEATURE_COUNT);
    });

    const tensor = new runtime.Tensor("float32", input, [...LSB_REFERENCE_V4.inputShape]);
    const outputs = await session.run({ [LSB_REFERENCE_V4.inputName]: tensor });
    const output = outputs[session.outputNames[0] ?? ""];
    if (!output || !(output.data instanceof Float32Array)) {
      throw new Error("El modelo no devolvió logits float32.");
    }
    return selectTopClass(output.data);
  }

  close(): void {
    this.closed = true;
    const session = this.session;
    this.session = null;
    this.runtime = null;
    if (session) void session.release();
  }
}
