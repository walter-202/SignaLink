import { createHash } from "node:crypto";

export class EvaluationInputError extends Error {
  constructor(code) { super(code); this.name = "EvaluationInputError"; this.code = code; }
}
const fail = () => { throw new EvaluationInputError("invalid-format"); };
export function object(value, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const keys = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) || keys.some((key) => ![...required, ...optional].includes(key))) fail();
  return value;
}
export function oneOf(value, choices) { if (!choices.includes(value)) fail(); return value; }
export function text(value, pattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/) {
  if (typeof value !== "string" || !pattern.test(value)) fail(); return value;
}
export function number(value, minimum = 0, maximum = 3_600_000) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) fail(); return value;
}
export function array(value, maximum = 10_000) { if (!Array.isArray(value) || value.length > maximum) fail(); return value; }
export function unique(values) { if (new Set(values).size !== values.length) fail(); }
export function sha256(value) { return text(value, /^[a-f0-9]{64}$/); }

export function parseCorpus(input) {
  const corpus = object(input, ["schemaVersion", "datasetId", "language", "task", "evidence", "labels", "clips"]);
  oneOf(corpus.schemaVersion, [1]); text(corpus.datasetId);
  oneOf(corpus.language, ["LSB"]); oneOf(corpus.task, ["isolated-sign"]);
  oneOf(corpus.evidence, ["synthetic", "recorded"]);
  array(corpus.labels, 256).forEach((label) => {
    object(label, ["id", "sourceRef", "validation"]);
    text(label.id); text(label.sourceRef); oneOf(label.validation, ["pending", "validated"]);
  });
  unique(corpus.labels.map((label) => label.id));
  const labels = new Set(corpus.labels.map((label) => label.id));
  array(corpus.clips).forEach((clip) => {
    object(clip, ["id", "participantId", "sessionId", "split", "assetSha256", "durationMs", "kind", "labelId", "onsetMs", "endMs", "sourceRef", "authorizationRef", "authorizationStatus", "annotationStatus", "regionId", "conditionId", "deviceId", "variantId"]);
    for (const key of ["id", "participantId", "sessionId", "sourceRef", "authorizationRef", "regionId", "conditionId", "deviceId", "variantId"]) text(clip[key]);
    sha256(clip.assetSha256);
    oneOf(clip.split, ["train", "validation", "test"]);
    oneOf(clip.kind, ["sign", "rest", "non-sign"]);
    oneOf(clip.authorizationStatus, ["pending", "verified", "withdrawn"]);
    oneOf(clip.annotationStatus, ["pending", "reviewed"]);
    number(clip.durationMs, 1, 60_000);
    if (clip.kind === "sign") {
      if (!labels.has(clip.labelId)) fail();
      number(clip.onsetMs, 0, clip.durationMs); number(clip.endMs, clip.onsetMs, clip.durationMs);
      if (clip.endMs === clip.onsetMs) fail();
    } else if (clip.labelId !== null || clip.onsetMs !== null || clip.endMs !== null) fail();
  });
  unique(corpus.clips.map((clip) => clip.id));
  // Defensive copy: subsequent caller mutations cannot change a verified ledger.
  return structuredClone(corpus);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function corpusDigest(corpus) { return createHash("sha256").update(canonical(parseCorpus(corpus))).digest("hex"); }
export function runDigest(run) { return createHash("sha256").update(canonical(run)).digest("hex"); }

export function parseRun(input, corpus) {
  const run = object(input, ["schemaVersion", "datasetId", "corpusSha256", "split", "evidence", "runId", "model", "pipeline", "deviceProfileId", "browserProfileId", "condition", "clock", "results"]);
  oneOf(run.schemaVersion, [1]); oneOf(run.split, ["test"]);
  oneOf(run.evidence, ["synthetic", "recorded"]);
  for (const key of ["datasetId", "runId", "deviceProfileId", "browserProfileId"]) text(run[key]);
  oneOf(run.condition, ["cold", "warm"]); oneOf(run.clock, ["realtime-clip-start-ms"]);
  object(run.model, ["id", "version", "sha256", "trainingParticipantAudit", "labelIds"]);
  text(run.model.id); text(run.model.version, /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/); sha256(run.model.sha256);
  oneOf(run.model.trainingParticipantAudit, ["unknown", "verified-disjoint"]);
  const labelIds = array(run.model.labelIds, 256).map((id) => text(id)); unique(labelIds);
  object(run.pipeline, ["version", "codeRevision", "featureSchema", "preprocessorId", "inputShape", "frameIntervalMs", "confidenceThreshold", "minimumMargin", "landmarkModelSha256", "landmarkRuntime", "delegate", "classifierRuntime"]);
  for (const key of ["version", "featureSchema", "preprocessorId", "classifierRuntime"]) text(run.pipeline[key]);
  oneOf(run.pipeline.landmarkRuntime, ["main-thread", "worker"]); oneOf(run.pipeline.delegate, ["CPU", "GPU"]);
  text(run.pipeline.codeRevision, /^[a-f0-9]{40}$/); sha256(run.pipeline.landmarkModelSha256);
  const shape = array(run.pipeline.inputShape, 3);
  if (shape.length !== 3 || shape[0] !== 1 || shape.some((value) => !Number.isInteger(value))) fail();
  number(shape[1], 2, 300); number(shape[2], 1, 4096);
  number(run.pipeline.frameIntervalMs, 1, 1000);
  number(run.pipeline.confidenceThreshold, 0, 1); number(run.pipeline.minimumMargin, 0, 1);
  const declaredLabels = new Set(corpus.labels.map((label) => label.id));
  if (labelIds.some((id) => !declaredLabels.has(id))) fail();
  sha256(run.corpusSha256);
  if (run.datasetId !== corpus.datasetId || run.corpusSha256 !== corpusDigest(corpus) || run.evidence !== corpus.evidence) throw new EvaluationInputError("corpus-mismatch");
  const expected = new Map(corpus.clips.filter((clip) => clip.split === "test").map((clip) => [clip.id, clip]));
  const results = array(run.results);
  unique(results.map((result) => result?.clipId));
  if (results.length !== expected.size) throw new EvaluationInputError("incomplete-results");
  let eventCount = 0;
  for (const result of results) {
    object(result, ["clipId", "status", "observedUntilMs", "proposals"]); text(result.clipId);
    const clip = expected.get(result.clipId);
    if (!clip) throw new EvaluationInputError("sample-mismatch");
    oneOf(result.status, ["completed", "error"]);
    number(result.observedUntilMs, 0, clip.durationMs);
    if (result.status === "completed" && result.observedUntilMs !== clip.durationMs) fail();
    let previous = -1;
    for (const proposal of array(result.proposals)) {
      object(proposal, ["labelId", "visibleAtMs"]);
      if (!labelIds.includes(proposal.labelId)) fail();
      number(proposal.visibleAtMs, 0, result.observedUntilMs);
      if (proposal.visibleAtMs <= previous) fail();
      previous = proposal.visibleAtMs;
      if (++eventCount > 100_000) fail();
    }
  }
  return structuredClone(run);
}
