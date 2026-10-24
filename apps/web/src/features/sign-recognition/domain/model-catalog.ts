import type { SignModelManifest } from "./sign-model";
import { LSB_V4_FEATURE_CONTRACT } from "./landmarks";

export const LSB_REFERENCE_LABELS = Object.freeze([
  "O", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "LL",
  "M", "N", "Ñ", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  " ", "HOLA", "BUENOS DIAS", "GRACIAS", "POR FAVOR", "YO", "ABOGADO", "DOCTOR",
  "ELECTRICISTA", "POLICIA", "PRESIDENTE", "PROFESOR", "NOMBRE", "ES", "MI",
  "TRABAJO", "LA PAZ", "SUCRE", "COCHABAMBA", "VIVO",
] as const);


export const LSB_REFERENCE_V4 = Object.freeze({
  manifestVersion: 1,
  version: "4.0.0",
  languageCode: "LSB",
  taskKind: "isolated-sign",
  format: "onnx",
  runtime: "onnx-wasm",
  adapterId: "onnx-sequence-v1",
  executionApproved: true,
  validationStatus: "experimental",
  featureSchema: LSB_V4_FEATURE_CONTRACT.featureSchema,
  preprocessorId: LSB_V4_FEATURE_CONTRACT.preprocessorId,
  normalization: LSB_V4_FEATURE_CONTRACT.normalization,
  landmarkOrder: LSB_V4_FEATURE_CONTRACT.landmarkOrder,
  frameIntervalMs: 33,
  outputName: "output",
  outputKind: "logits",
  labels: LSB_REFERENCE_LABELS,
  minimumMargin: 0,
  limitations: Object.freeze([
    "Vocabulario limitado de 58 etiquetas; no traduce conversaciones.",
    "Umbral experimental sin calibrar; requiere revisión humana.",
    "Sin evaluación representativa con participantes LSB no vistos.",
  ]),
  id: "lsb-reference-v4",
  name: "LSB · referencia v4",
  language: "Lengua de Señas Boliviana (LSB)",
  task: "Clasificación de una secuencia aislada de 30 fotogramas",
  modelUrl: "/models/lsb-reference-v4/model_transformer_enco_v4.onnx",
  modelBytes: 7_206_466,
  sha256: "976cc4071de03c4deea46f1219e3cf98ad779c17df12148152f64b704f957ee2",
  inputName: "input",
  inputShape: Object.freeze([1, 30, 138] as const),
  outputClasses: LSB_REFERENCE_LABELS.length,
  confidenceThreshold: 0.5,
  sourceUrl: "https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB",
  license: "MIT",
} satisfies SignModelManifest);


export function formatMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
