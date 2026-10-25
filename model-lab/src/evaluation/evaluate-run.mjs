import { auditCorpus } from "../collection/audit-corpus.mjs";
import { EvaluationInputError, parseCorpus, parseRun, runDigest } from "./contracts.mjs";

const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;
function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (fraction) => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
  return { samples: sorted.length, mean: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null, p50: percentile(0.5), p95: percentile(0.95) };
}

/** Isolated-clip evaluation of an explicit ledger, not an inference runner. */
export function evaluateRun(corpusInput, runInput) {
  const corpus = parseCorpus(corpusInput);
  const run = parseRun(runInput, corpus);
  const audit = auditCorpus(corpus);
  const blocked = new Set(["empty-label-catalog", "empty-test-split", "pending-label-validation", "pending-authorization", "withdrawn-authorization", "pending-annotation-review", "participant-leakage", "duplicate-clip-hash"]);
  if (audit.findings.some((finding) => blocked.has(finding.code))) throw new EvaluationInputError("corpus-not-ready");
  const labels = corpus.labels.map((label) => label.id);
  const rows = [...labels, "$background"];
  const columns = [...labels, "$abstain", "$error", "$premature"];
  const matrix = rows.map(() => columns.map(() => 0));
  const predictions = new Map(run.results.map((result) => [result.clipId, result]));
  const testClips = corpus.clips.filter((clip) => clip.split === "test");
  const classes = new Map(labels.map((id) => [id, { labelId: id, support: 0, truePositives: 0, falsePositives: 0, falseNegatives: 0 }]));
  const participants = new Map(); const latencies = [];
  let signClips = 0; let correctSigns = 0; let abstentions = 0; let errors = 0; let extras = 0;
  let negativeClips = 0; let cleanNegatives = 0; let negativeExposureMs = 0; let falseAlarms = 0;
  let incompleteNegatives = 0; let prematureProposals = 0;
  for (const clip of testClips) {
    const result = predictions.get(clip.id);
    const first = result.proposals[0];
    const group = participants.get(clip.participantId) ?? { signs: 0, correct: 0, abstained: 0, errors: 0 };
    extras += Math.max(0, result.proposals.length - 1);
    if (result.status === "error") errors++;
    let predicted = result.status === "error" ? "$error" : first?.labelId ?? "$abstain";
    const truth = clip.kind === "sign" ? clip.labelId : "$background";
    if (clip.kind === "sign") {
      signClips++; group.signs++; classes.get(truth).support++;
      if (result.status === "error") group.errors++;
      prematureProposals += result.proposals.filter((proposal) => proposal.visibleAtMs < clip.onsetMs).length;
      if (result.status === "completed" && first && first.visibleAtMs < clip.onsetMs) predicted = "$premature";
      if (predicted === "$abstain") { abstentions++; group.abstained++; }
      if (predicted === truth) {
        correctSigns++; group.correct++; classes.get(truth).truePositives++;
        latencies.push(first.visibleAtMs - clip.onsetMs);
      } else {
        classes.get(truth).falseNegatives++;
        if (classes.has(predicted)) classes.get(predicted).falsePositives++;
      }
    } else {
      negativeClips++; negativeExposureMs += result.observedUntilMs;
      falseAlarms += result.proposals.length; // Every visible alarm counts, including repetitions.
      if (result.status === "error") incompleteNegatives++;
      if (result.status === "completed" && !first) cleanNegatives++;
      if (classes.has(predicted)) classes.get(predicted).falsePositives++;
    }
    participants.set(clip.participantId, group);
    matrix[rows.indexOf(truth)][columns.indexOf(predicted)]++;
  }
  const perClass = [...classes.values()].map((item) => ({ ...item,
    precision: ratio(item.truePositives, item.truePositives + item.falsePositives),
    recall: ratio(item.truePositives, item.support),
    f1: ratio(2 * item.truePositives, 2 * item.truePositives + item.falsePositives + item.falseNegatives),
  }));
  const supportedClasses = perClass.filter((item) => item.support > 0);
  const macro = supportedClasses.length ? supportedClasses.reduce((sum, item) => sum + (item.f1 ?? 0), 0) / supportedClasses.length : null;
  const missingClasses = perClass.filter((item) => item.support === 0).map((item) => item.labelId);
  const participantGroups = [...participants.values()].filter((group) => group.signs > 0);
  return {
    schemaVersion: 1, evaluatorVersion: "isolated-clip-v1", task: "isolated-sign",
    evidence: run.evidence, corpusSha256: audit.corpusSha256, runSha256: runDigest(run),
    model: { id: run.model.id, version: run.model.version, sha256: run.model.sha256 },
    pipeline: run.pipeline,
    metadataReady: audit.metadataReady, findings: audit.findings,
    promotion: "not-evaluated", latencyGoal50Percent: "not-evaluated", unseenSignerClaimVerifiedByTool: false,
    counts: { clips: testClips.length, signClips, negativeClips, correctSigns, cleanNegatives, abstentions, errors, extraProposals: extras, prematureSignProposals: prematureProposals },
    accuracySigns: ratio(correctSigns, signClips), accuracyAllClips: ratio(correctSigns + cleanNegatives, testClips.length),
    abstentionRateSigns: ratio(abstentions, signClips), errorRate: ratio(errors, testClips.length),
    macroF1: missingClasses.length ? null : macro, macroF1SupportedClasses: macro, missingTestClasses: missingClasses,
    perClass, confusion: { rows, columns, counts: matrix },
    negativeExposure: { observedMs: negativeExposureMs, falseAlarms, incompleteClips: incompleteNegatives,
      coverageComplete: negativeClips > 0 && incompleteNegatives === 0,
      falsePositivesPerMinute: ratio(falseAlarms * 60_000, negativeExposureMs) },
    latencyMs: { ...summary(latencies), scope: "correct-first-visible-proposals-only", correctSignCoverage: ratio(correctSigns, signClips), rejectedOrFailedSigns: signClips - correctSigns },
    participants: { count: participants.size, signParticipantCount: participantGroups.length,
      accuracySigns: summary(participantGroups.map((group) => group.correct / group.signs)),
      abstentionRateSigns: summary(participantGroups.map((group) => group.abstained / group.signs)),
      errorRateSigns: summary(participantGroups.map((group) => group.errors / group.signs)) },
    limitations: [
      run.evidence === "synthetic" ? "Synthetic ledger: these numbers do not measure an LSB model." : "Metrics describe supplied annotations and outputs; this tool did not run or verify the underlying recordings.",
      run.model.trainingParticipantAudit === "unknown" ? "Model training participants are unknown; unseen-signer generalization is not established." : "Training-participant separation was declared externally; this tool did not inspect model training data.",
      "First visible proposal determines isolated-clip classification; later corrections do not rescue it. Background alarm rate counts every event.",
      "Latency describes only correct first proposals. Errors, abstentions, premature and wrong proposals remain in denominators and coverage.",
      "Macro F1 is undefined for the full catalog if any test class lacks support. No WER, CER, translation, calibration or statistical promotion is evaluated.",
      "Participant summaries contain no IDs and are descriptive, not confidence intervals or proof of anonymization.",
    ],
  };
}
