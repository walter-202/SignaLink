import { z } from "zod";
import type { SignModelManifest } from "../domain/sign-model";

export interface ModelAdapterCapability {
  adapterId: string;
  format: string;
  runtime: string;
  featureSchema: string;
  preprocessorId: string;
  normalization: string;
  landmarkOrder: readonly string[];
  featureCount: number;
}

const nonEmpty = z.string().min(1);
const manifestSchema = z.object({
  manifestVersion: z.literal(1),
  id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: nonEmpty,
  language: nonEmpty,
  languageCode: nonEmpty,
  task: nonEmpty,
  taskKind: z.literal("isolated-sign"),
  format: nonEmpty,
  runtime: nonEmpty,
  adapterId: nonEmpty,
  executionApproved: z.boolean(),
  validationStatus: z.enum(["experimental", "validated"]),
  modelUrl: z.string().regex(/^\/models\/[a-zA-Z0-9/_.-]+\.onnx$/).refine((url) => !url.split("/").includes("..")),
  modelBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/).toLowerCase(),
  inputName: nonEmpty,
  inputShape: z.tuple([z.literal(1), z.number().int().min(2).max(300), z.number().int().positive().max(4096)]),
  featureSchema: nonEmpty,
  preprocessorId: nonEmpty,
  normalization: nonEmpty,
  landmarkOrder: z.array(nonEmpty).min(1),
  frameIntervalMs: z.number().positive().max(1000),
  outputName: nonEmpty,
  outputKind: z.literal("logits"),
  outputClasses: z.number().int().positive(),
  labels: z.array(nonEmpty).min(1),
  confidenceThreshold: z.number().min(0).max(1),
  minimumMargin: z.number().min(0).max(1),
  sourceUrl: z.string().url().refine((url) => new URL(url).protocol === "https:"),
  license: nonEmpty,
  limitations: z.array(nonEmpty).min(1),
}).strict().superRefine((manifest, context) => {
  if (manifest.labels.length !== manifest.outputClasses || new Set(manifest.labels).size !== manifest.labels.length) {
    context.addIssue({ code: "custom", message: "Las etiquetas deben ser únicas y coincidir con las clases de salida." });
  }
});

/** Curated manifests only; validates and snapshots data before any download is possible. */
export class ModelRegistry {
  private readonly models = new Map<string, SignModelManifest>();
  private readonly capabilities: readonly ModelAdapterCapability[];

  constructor(manifests: readonly unknown[], capabilities: readonly ModelAdapterCapability[]) {
    this.capabilities = capabilities.map((capability) => Object.freeze({ ...capability, landmarkOrder: Object.freeze([...capability.landmarkOrder]) }));
    for (const value of manifests) {
      const parsed = manifestSchema.parse(value);
      if (this.models.has(parsed.id)) throw new Error(`Modelo duplicado: ${parsed.id}.`);
      this.models.set(parsed.id, Object.freeze({ ...parsed,
        inputShape: Object.freeze(parsed.inputShape),
        labels: Object.freeze(parsed.labels),
        landmarkOrder: Object.freeze(parsed.landmarkOrder),
        limitations: Object.freeze(parsed.limitations),
      }));
    }
  }

  list(): readonly SignModelManifest[] {
    return Object.freeze([...this.models.values()]);
  }

  available(): readonly SignModelManifest[] {
    return Object.freeze(this.list().filter((model) => {
      try { this.resolve(model.id); return true; } catch { return false; }
    }));
  }

  resolve(id: string): SignModelManifest {
    const model = this.models.get(id);
    if (!model) throw new Error(`Modelo no registrado: ${id}.`);
    if (!model.executionApproved) throw new Error(`El modelo ${id} no está habilitado para ejecución.`);
    const compatible = this.capabilities.some((capability) =>
      capability.adapterId === model.adapterId && capability.format === model.format
      && capability.runtime === model.runtime && capability.featureSchema === model.featureSchema
      && capability.preprocessorId === model.preprocessorId && capability.normalization === model.normalization
      && capability.featureCount === model.inputShape[2]
      && capability.landmarkOrder.length === model.landmarkOrder.length
      && capability.landmarkOrder.every((part, index) => part === model.landmarkOrder[index]),
    );
    if (!compatible) throw new Error(`Contrato de modelo incompatible: ${id}. No hay adaptador y preprocesador compatibles.`);
    return model;
  }
}
