import type { SignModelManifest } from "../domain/sign-model";
import type { SignClassification, SignClassifier } from "../application/ports/sign-classifier";
import type { RecognitionPerformance } from "../application/recognition-performance";

const WASM_ROOT = "/onnxruntime/wasm/";

export function decodeLogits(logits: ArrayLike<number>, labels: readonly string[]) {
  if (logits.length !== labels.length || logits.length === 0) {
    throw new Error(`El modelo devolvió ${logits.length} valores; se esperaban ${labels.length}.`);
  }
  let classIndex = 0;
  let maxLogit = Number.NEGATIVE_INFINITY;
  let secondLogit = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < logits.length; index += 1) {
    const logit = logits[index];
    if (!Number.isFinite(logit)) throw new Error("El modelo devolvió una predicción no válida.");
    if (logit > maxLogit) {
      secondLogit = maxLogit;
      maxLogit = logit;
      classIndex = index;
    } else if (logit > secondLogit) {
      secondLogit = logit;
    }
  }
  let denominator = 0;
  for (let index = 0; index < logits.length; index += 1) denominator += Math.exp(logits[index] - maxLogit);
  const confidence = 1 / denominator;
  const margin = confidence - Math.exp(secondLogit - maxLogit) / denominator;
  return { label: labels[classIndex] ?? "", classIndex, confidence, margin };
}

export function decodeModelPrediction(logits: ArrayLike<number>, model: SignModelManifest): SignClassification {
  const scores = decodeLogits(logits, model.labels);
  return {
    ...scores,
    modelId: model.id,
    modelVersion: model.version,
    decision: scores.confidence >= model.confidenceThreshold && scores.margin >= model.minimumMargin ? "candidate" : "uncertain",
  };
}

export class OnnxSequenceClassifier implements SignClassifier {
  private session: import("onnxruntime-web/wasm").InferenceSession | null = null;
  private runtime: typeof import("onnxruntime-web/wasm") | null = null;
  private closed = false;
  private readonly downloadController = new AbortController();
  private initializing: Promise<void> | null = null;
  private running: Promise<SignClassification> | null = null;

  constructor(readonly model: SignModelManifest, private readonly metrics?: RecognitionPerformance) {}

  initialize(onStage?: (message: string) => void): Promise<void> {
    if (this.closed) return Promise.reject(new Error("El clasificador está cerrado."));
    if (this.session) return Promise.resolve();
    this.initializing ??= this.load(onStage).finally(() => { this.initializing = null; });
    return this.initializing;
  }

  private async load(onStage?: (message: string) => void): Promise<void> {
    onStage?.("Preparando el motor de inferencia local…");
    const runtime = await import("onnxruntime-web/wasm");
    if (this.closed) throw new Error("El clasificador está cerrado.");
    runtime.env.wasm.wasmPaths = {
      wasm: `${WASM_ROOT}ort-wasm-simd-threaded.wasm`,
      mjs: `${WASM_ROOT}ort-wasm-simd-threaded.mjs`,
    };
    runtime.env.wasm.numThreads = 1;
    this.runtime = runtime;

    onStage?.(`Descargando el modelo (${(this.model.modelBytes / (1024 * 1024)).toFixed(1)} MiB)…`);
    const downloadStartedAt = performance.now();
    const response = await fetch(this.model.modelUrl, { cache: "force-cache", signal: this.downloadController.signal });
    if (!response.ok) throw new Error(`No se pudo descargar el modelo (${response.status}).`);
    const modelBytes = new Uint8Array(await response.arrayBuffer());
    if (this.closed) throw new Error("El clasificador está cerrado.");
    if (modelBytes.byteLength !== this.model.modelBytes) throw new Error("El tamaño del modelo no coincide con su manifiesto.");
    this.metrics?.record("modelDownloadMs", performance.now() - downloadStartedAt);
    if (this.closed) throw new Error("El clasificador está cerrado.");
    const integrityStartedAt = performance.now();
    const digest = await crypto.subtle.digest("SHA-256", modelBytes);
    if (this.closed) throw new Error("El clasificador está cerrado.");
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (sha256 !== this.model.sha256) throw new Error("El archivo del modelo no coincide con su hash SHA-256.");
    this.metrics?.record("modelIntegrityMs", performance.now() - integrityStartedAt);

    onStage?.("Inicializando el modelo en este dispositivo…");
    const sessionStartedAt = performance.now();
    const session = await runtime.InferenceSession.create(modelBytes, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    if (this.closed) {
      await session.release();
      throw new Error("El clasificador está cerrado.");
    }
    if (session.inputNames.length !== 1 || !session.inputNames.includes(this.model.inputName) || !session.outputNames.includes(this.model.outputName)) {
      await session.release();
      throw new Error("Los nombres de entrada/salida del ONNX no coinciden con su manifiesto.");
    }
    const inputMetadata = session.inputMetadata[0];
    const outputMetadata = session.outputMetadata.find((value) => value.name === this.model.outputName);
    if (!inputMetadata?.isTensor || inputMetadata.type !== "float32" || inputMetadata.shape.length !== 3
      || inputMetadata.shape.some((dimension, index) => typeof dimension === "number" && dimension !== this.model.inputShape[index])
      || !outputMetadata?.isTensor || outputMetadata.type !== "float32"
      || outputMetadata.shape.length < 1 || outputMetadata.shape.length > 2
      || (outputMetadata.shape.length === 2 && typeof outputMetadata.shape[0] === "number" && outputMetadata.shape[0] !== 1)
      || (typeof outputMetadata.shape.at(-1) === "number" && outputMetadata.shape.at(-1) !== this.model.outputClasses)) {
      await session.release();
      throw new Error("Los tipos o dimensiones del ONNX no coinciden con el manifiesto.");
    }
    this.session = session;
    this.runtime = runtime;
    this.metrics?.record("modelSessionMs", performance.now() - sessionStartedAt);
  }

  classify(sequence: readonly Float32Array[]): Promise<SignClassification> {
    if (this.closed) return Promise.reject(new Error("El clasificador está cerrado."));
    if (this.running) return Promise.reject(new Error("Ya hay una inferencia en curso para este modelo."));
    this.running = this.run(sequence).finally(() => { this.running = null; });
    return this.running;
  }

  private async run(sequence: readonly Float32Array[]): Promise<SignClassification> {
    const session = this.session;
    const runtime = this.runtime;
    if (!session || !runtime) throw new Error("El modelo todavía no está cargado.");
    if (sequence.length !== this.model.inputShape[1]) {
      throw new Error(`La captura necesita ${this.model.inputShape[1]} fotogramas.`);
    }

    const input = new Float32Array(this.model.inputShape[1] * this.model.inputShape[2]);
    sequence.forEach((frame, frameIndex) => {
      if (frame.length !== this.model.inputShape[2]) {
        throw new Error(`El fotograma ${frameIndex + 1} no contiene ${this.model.inputShape[2]} características.`);
      }
      if (!frame.every(Number.isFinite)) throw new Error("La captura contiene características no finitas.");
      input.set(frame, frameIndex * this.model.inputShape[2]);
    });

    const tensor = new runtime.Tensor("float32", input, [...this.model.inputShape]);
    const outputs = await session.run({ [this.model.inputName]: tensor });
    const output = outputs[this.model.outputName];
    if (!output || !(output.data instanceof Float32Array) || output.dims.length < 1 || output.dims.length > 2
      || (output.dims.length === 2 && output.dims[0] !== 1) || output.dims.at(-1) !== this.model.outputClasses) {
      throw new Error("El modelo no devolvió logits float32.");
    }
    return decodeModelPrediction(output.data, this.model);
  }

  close(): void {
    this.closed = true;
    this.downloadController.abort();
    const session = this.session;
    this.session = null;
    this.runtime = null;
    if (session) {
      const release = () => session.release();
      // A model switch invalidates results immediately but releases WASM only after its run settles.
      const disposal = this.running ? this.running.then(release, release) : release();
      void disposal.catch(() => undefined); // close() is best-effort and cannot report into an unmounted view.
    }
  }
}
