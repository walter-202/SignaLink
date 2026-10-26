import { evaluateRun } from "./evaluate-run.mjs";
import { EvaluationInputError, parseCorpus, parseRun } from "./contracts.mjs";

const ratio = (numerator, denominator) => Number.isFinite(numerator) && denominator > 0 ? numerator / denominator : null;

function quantile(values, percentile) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * percentile) - 1)] : null;
}

function requireSame(condition) {
  if (!condition) throw new EvaluationInputError("comparison-mismatch");
}

function comparableRunMetadata(run) {
  return {
    datasetId: run.datasetId,
    corpusSha256: run.corpusSha256,
    evidence: run.evidence,
    condition: run.condition,
    deviceProfileId: run.deviceProfileId,
    browserProfileId: run.browserProfileId,
    model: {
      id: run.model.id,
      version: run.model.version,
      sha256: run.model.sha256,
      trainingParticipantAudit: run.model.trainingParticipantAudit,
      labelIds: [...run.model.labelIds].sort(),
    },
    pipeline: {
      version: run.pipeline.version,
      codeRevision: run.pipeline.codeRevision,
      featureSchema: run.pipeline.featureSchema,
      preprocessorId: run.pipeline.preprocessorId,
      inputShape: run.pipeline.inputShape,
      frameIntervalMs: run.pipeline.frameIntervalMs,
      confidenceThreshold: run.pipeline.confidenceThreshold,
      minimumMargin: run.pipeline.minimumMargin,
      landmarkModelSha256: run.pipeline.landmarkModelSha256,
      delegate: run.pipeline.delegate,
      classifierRuntime: run.pipeline.classifierRuntime,
    },
  };
}

function isCorrectFirstProposal(clip, result) {
  const first = result.proposals[0];
  return clip.kind === "sign" && result.status === "completed" && first?.labelId === clip.labelId && first.visibleAtMs >= clip.onsetMs;
}

function thresholdStatus(evidence, value, limit, relation) {
  if (evidence !== "recorded" || value === null) return "not-evaluated";
  return relation(value, limit) ? "pass" : "fail";
}

/** Strict baseline-main-thread vs candidate-Worker comparison on the frozen same corpus. */
export function compareRuns(corpusInput, baselineInput, candidateInput) {
  const corpus = parseCorpus(corpusInput);
  const baseline = parseRun(baselineInput, corpus);
  const candidate = parseRun(candidateInput, corpus);
  const baselineReport = evaluateRun(corpus, baseline);
  const candidateReport = evaluateRun(corpus, candidate);
  requireSame(JSON.stringify(comparableRunMetadata(baseline)) === JSON.stringify(comparableRunMetadata(candidate)));
  requireSame(baseline.runId !== candidate.runId);
  requireSame(baseline.pipeline.landmarkRuntime === "main-thread" && candidate.pipeline.landmarkRuntime === "worker");
  requireSame(baseline.pipeline.delegate === candidate.pipeline.delegate);

  const latencyRatio = {
    p50: ratio(candidateReport.latencyMs.p50, baselineReport.latencyMs.p50),
    p95: ratio(candidateReport.latencyMs.p95, baselineReport.latencyMs.p95),
  };
  const baselineResults = new Map(baseline.results.map((result) => [result.clipId, result]));
  const candidateResults = new Map(candidate.results.map((result) => [result.clipId, result]));
  const pairedRelativeLatencies = [];
  let pairedCorrectSamples = 0;
  for (const clip of corpus.clips) {
    if (clip.split !== "test" || clip.kind !== "sign") continue;
    const baselineResult = baselineResults.get(clip.id);
    const candidateResult = candidateResults.get(clip.id);
    if (!isCorrectFirstProposal(clip, baselineResult) || !isCorrectFirstProposal(clip, candidateResult)) continue;
    pairedCorrectSamples += 1;
    const before = baselineResult.proposals[0].visibleAtMs - clip.onsetMs;
    const after = candidateResult.proposals[0].visibleAtMs - clip.onsetMs;
    if (before > 0) pairedRelativeLatencies.push(after / before);
  }
  const pairedRatios = {
    samples: pairedRelativeLatencies.length,
    p50: quantile(pairedRelativeLatencies, 0.5),
    p95: quantile(pairedRelativeLatencies, 0.95),
  };

  const f1DropPercentagePoints = baselineReport.macroF1 === null || candidateReport.macroF1 === null
    ? null
    : (candidateReport.macroF1 - baselineReport.macroF1) * 100;
  const falseAlarmRatio = ratio(
    candidateReport.negativeExposure.falsePositivesPerMinute,
    baselineReport.negativeExposure.falsePositivesPerMinute,
  );
  const falseAlarmGate = baselineReport.negativeExposure.falsePositivesPerMinute === null
    || candidateReport.negativeExposure.falsePositivesPerMinute === null
    ? "not-evaluated"
    : thresholdStatus(corpus.evidence, candidateReport.negativeExposure.falsePositivesPerMinute,
      baselineReport.negativeExposure.falsePositivesPerMinute, (value, limit) => value <= limit);
  const evidence = corpus.evidence;
  return {
    schemaVersion: 1,
    comparisonVersion: "paired-recognition-v1",
    evidence,
    comparable: true,
    baseline: {
      runId: baseline.runId,
      landmarkRuntime: baseline.pipeline.landmarkRuntime,
      delegate: baseline.pipeline.delegate,
      latencyMs: baselineReport.latencyMs,
      macroF1: baselineReport.macroF1,
      falsePositivesPerMinute: baselineReport.negativeExposure.falsePositivesPerMinute,
      accuracySigns: baselineReport.accuracySigns,
      abstentionRateSigns: baselineReport.abstentionRateSigns,
      errorRate: baselineReport.errorRate,
    },
    candidate: {
      runId: candidate.runId,
      landmarkRuntime: candidate.pipeline.landmarkRuntime,
      delegate: candidate.pipeline.delegate,
      latencyMs: candidateReport.latencyMs,
      macroF1: candidateReport.macroF1,
      falsePositivesPerMinute: candidateReport.negativeExposure.falsePositivesPerMinute,
      accuracySigns: candidateReport.accuracySigns,
      abstentionRateSigns: candidateReport.abstentionRateSigns,
      errorRate: candidateReport.errorRate,
    },
    paired: {
      correctInBothSamples: pairedCorrectSamples,
      positiveBaselineLatencySamples: pairedRelativeLatencies.length,
      relativeLatencyRatio: pairedRatios,
    },
    changes: {
      overallLatencyRatio: latencyRatio,
      macroF1DropPercentagePoints: f1DropPercentagePoints,
      falsePositivesPerMinuteRatio: falseAlarmRatio,
      falsePositivesPerMinuteChange: baselineReport.negativeExposure.falsePositivesPerMinute === null
        || candidateReport.negativeExposure.falsePositivesPerMinute === null
        ? null
        : candidateReport.negativeExposure.falsePositivesPerMinute - baselineReport.negativeExposure.falsePositivesPerMinute,
    },
    rawThresholds: {
      overallLatencyP50AtLeast50PercentReduction: thresholdStatus(evidence, latencyRatio.p50, 0.5, (value, limit) => value <= limit),
      overallLatencyP95AtLeast50PercentReduction: thresholdStatus(evidence, latencyRatio.p95, 0.5, (value, limit) => value <= limit),
      pairedLatencyP50AtLeast50PercentReduction: thresholdStatus(evidence, pairedRatios.p50, 0.5, (value, limit) => value <= limit),
      pairedLatencyP95AtLeast50PercentReduction: thresholdStatus(evidence, pairedRatios.p95, 0.5, (value, limit) => value <= limit),
      macroF1DropWithinOnePercentagePoint: thresholdStatus(evidence, f1DropPercentagePoints, -1, (value, limit) => value >= limit),
      falsePositivesPerMinuteDoesNotIncrease: falseAlarmGate,
    },
    promotion: "not-evaluated",
    limitations: [
      evidence === "synthetic" ? "Synthetic comparison: these values do not measure an LSB model." : "Raw thresholds describe these supplied clips only; no uncertainty or sample-size analysis is performed.",
      "Latency uses correct first visible proposals; paired latency uses only clips correctly recognized by both modes.",
      "A passing raw threshold is not model promotion, linguistic validation or evidence of generalization to unseen signers.",
    ],
  };
}
