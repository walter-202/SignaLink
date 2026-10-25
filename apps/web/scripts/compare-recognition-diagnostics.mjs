import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const nonnegative = z.number().finite().nonnegative();
const series = z.object({
  total: nonnegative.int(), samples: z.number().int().min(1).max(120),
  mean: nonnegative, p50: nonnegative, p95: nonnegative,
}).refine((value) => value.total >= value.samples && value.p95 >= value.p50);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const reportSchema = z.object({
  schemaVersion: z.literal(4), pipelineVersion: z.string().max(80),
  modelId: z.string().max(80), modelVersion: z.string().max(80), modelSha256: hash,
  featureSchema: z.string().max(80), inputShape: z.tuple([z.literal(1), z.number().int().positive(), z.number().int().positive()]),
  runtime: z.string().max(80), frameIntervalMs: z.number().positive().finite(),
  confidenceThreshold: z.number().min(0).max(1), minimumMargin: z.number().min(0).max(1),
  landmarkRuntime: z.object({
    mode: z.enum(["main-thread", "worker"]), fallback: z.string().max(80).optional(),
    asset: z.object({ integrity: z.enum(["verified", "unverified"]), sha256: hash.optional(), bytes: nonnegative.int(), version: z.string().max(80).optional() }).optional(),
  }).nullable(),
  timings: z.record(z.string(), series),
});
const stages = ["landmarkLoadMs", "landmarkAssetReadMs", "landmarkMs", "featuresMs", "frameIntervalMs", "inferenceMs", "segmentToPredictionMs", "uiDelayMs", "uiLongTaskMs"];

/** Compares aggregate diagnostics only; never approves a model or the 50% goal. */
export function compareRecognitionDiagnostics(baselineInput, candidateInput) {
  const baseline = reportSchema.parse(baselineInput);
  const candidate = reportSchema.parse(candidateInput);
  const issues = [];
  for (const key of ["pipelineVersion", "modelId", "modelVersion", "modelSha256", "featureSchema", "runtime", "frameIntervalMs", "confidenceThreshold", "minimumMargin"]) {
    if (baseline[key] !== candidate[key]) issues.push(`different-${key}`);
  }
  if (JSON.stringify(baseline.inputShape) !== JSON.stringify(candidate.inputShape)) issues.push("different-inputShape");
  if (baseline.landmarkRuntime?.mode !== "main-thread" || candidate.landmarkRuntime?.mode !== "worker") issues.push("expected-main-thread-to-worker");
  if (candidate.landmarkRuntime?.fallback) issues.push("candidate-used-fallback");
  const firstAsset = baseline.landmarkRuntime?.asset;
  const secondAsset = candidate.landmarkRuntime?.asset;
  if (firstAsset?.integrity !== "verified" || secondAsset?.integrity !== "verified" || !firstAsset?.sha256 || !secondAsset?.sha256) issues.push("unverified-holistic-asset");
  else if (firstAsset.sha256 !== secondAsset.sha256 || firstAsset.bytes !== secondAsset.bytes) issues.push("different-holistic-asset");
  const reduction = (before, after) => before === 0 ? null : Math.round(10000 * (1 - after / before)) / 100;
  return {
    scope: "aggregate-session-diagnostics", technicalContractsMatch: issues.length === 0, issues,
    promotion: "not-evaluated", latencyGoal50Percent: "not-evaluated",
    sameDeviceAndSamplesVerified: false, linguisticQualityEvaluated: false,
    stages: stages.map((stage) => {
      const first = baseline.timings[stage]; const second = candidate.timings[stage];
      if (!first || !second) return { stage, status: "missing-measurements" };
      return {
        stage, status: first.samples >= 30 && second.samples >= 30 ? "descriptive-comparison" : "few-samples",
        baseline: { samples: first.samples, p50: first.p50, p95: first.p95 },
        candidate: { samples: second.samples, p50: second.p50, p95: second.p95 },
        reductionPercent: { p50: reduction(first.p50, second.p50), p95: reduction(first.p95, second.p95) },
      };
    }),
    limitations: ["Rolling aggregates are not paired observations or confidence intervals.", "Device, corpus, cold/warm conditions, onset annotations, visible proposal and F1/false positives require a separate controlled evaluation."],
  };
}

async function readReport(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size > 128 * 1024) throw new Error("Expected a diagnostic JSON file no larger than 128 KiB.");
  return JSON.parse(await readFile(file, "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [baseline, candidate, extra] = process.argv.slice(2);
    if (!baseline || !candidate || extra) throw new Error("Usage: pnpm compare:recognition <baseline.json> <worker.json>");
    const result = compareRecognitionDiagnostics(await readReport(baseline), await readReport(candidate));
    console.log(JSON.stringify(result, null, 2));
    if (!result.technicalContractsMatch) process.exitCode = 2;
  } catch {
    console.error("No se pudieron comparar los diagnósticos. Usa dos JSON v4 exportados por la app (baseline y Worker), de hasta 128 KiB. No se muestran contenidos ni rutas de archivos.");
    process.exitCode = 1;
  }
}
