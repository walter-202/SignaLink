import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRun } from "../src/evaluation/evaluate-run.mjs";
import { corpusFixture, runFixture } from "./fixtures.mjs";

test("scores a perfect synthetic ledger and labels its latency subset and evidence honestly", () => {
  const corpus = corpusFixture(); const run = runFixture(corpus);
  const report = evaluateRun(corpus, run);
  assert.equal(report.evidence, "synthetic");
  assert.equal(report.accuracySigns, 1); assert.equal(report.accuracyAllClips, 1); assert.equal(report.macroF1, 1);
  assert.equal(report.negativeExposure.falsePositivesPerMinute, 0);
  assert.equal(report.latencyMs.p50, 500); assert.equal(report.latencyMs.p95, 500);
  assert.equal(report.latencyMs.samples, 4); assert.equal(report.latencyMs.correctSignCoverage, 1);
  assert.equal(report.promotion, "not-evaluated"); assert.equal(report.latencyGoal50Percent, "not-evaluated");
  assert.equal(report.unseenSignerClaimVerifiedByTool, false);
  assert.equal(report.participants.count, 2);
  assert.equal(JSON.stringify(report).includes("test-person-1"), false);
  assert.equal(JSON.stringify(report).includes("synthetic-permission"), false);
});

test("does not rescue wrong first proposals with later successes; counts abstentions, failures and every background alarm", () => {
  const corpus = corpusFixture(); const run = runFixture(corpus);
  run.results[0].proposals = [{ labelId: "label-b", visibleAtMs: 1500 }, { labelId: "label-a", visibleAtMs: 1700 }];
  run.results[1].proposals = [];
  run.results[2] = { clipId: "test-b1", status: "error", observedUntilMs: 1000, proposals: [] };
  run.results[3].proposals[0].visibleAtMs = 1800;
  run.results[4].proposals = [{ labelId: "label-a", visibleAtMs: 1000 }, { labelId: "label-a", visibleAtMs: 2000 }, { labelId: "label-b", visibleAtMs: 3000 }];
  const report = evaluateRun(corpus, run);
  assert.equal(report.accuracySigns, 0.25); assert.equal(report.accuracyAllClips, 2 / 6);
  assert.equal(report.abstentionRateSigns, 0.25); assert.equal(report.counts.errors, 1);
  assert.equal(report.macroF1, 0.25);
  assert.equal(report.negativeExposure.falseAlarms, 3); assert.equal(report.negativeExposure.falsePositivesPerMinute, 1.5);
  assert.equal(report.counts.extraProposals, 3);
  assert.equal(report.latencyMs.samples, 1); assert.equal(report.latencyMs.p50, 800);
  assert.equal(report.latencyMs.rejectedOrFailedSigns, 3); assert.equal(report.latencyMs.correctSignCoverage, 0.25);
  assert.equal(report.confusion.counts[0][1], 1);
});

test("a correct label appearing before the annotated onset is premature, not a zero-latency success", () => {
  const corpus = corpusFixture(); const run = runFixture(corpus);
  run.results[0].proposals = [{ labelId: "label-a", visibleAtMs: 500 }, { labelId: "label-a", visibleAtMs: 1500 }];
  const report = evaluateRun(corpus, run);
  assert.equal(report.counts.correctSigns, 3); assert.equal(report.counts.prematureSignProposals, 1);
  assert.equal(report.latencyMs.samples, 3); assert.equal(report.latencyMs.p50, 500);
  assert.equal(report.confusion.counts[0][report.confusion.columns.indexOf("$premature")], 1);
});

test("does not claim complete negative exposure when a background clip fails early", () => {
  const corpus = corpusFixture(); const run = runFixture(corpus);
  run.results[4] = { clipId: "rest", status: "error", observedUntilMs: 30_000, proposals: [{ labelId: "label-a", visibleAtMs: 1000 }] };
  const report = evaluateRun(corpus, run);
  assert.equal(report.negativeExposure.observedMs, 90_000);
  assert.equal(report.negativeExposure.coverageComplete, false);
  assert.equal(report.negativeExposure.falsePositivesPerMinute, 2 / 3);
  assert.equal(report.negativeExposure.incompleteClips, 1);
});

test("all abstentions produce zero F1 and no invented latency", () => {
  const corpus = corpusFixture(); const run = runFixture(corpus);
  for (const result of run.results) result.proposals = [];
  const report = evaluateRun(corpus, run);
  assert.equal(report.macroF1, 0); assert.equal(report.accuracySigns, 0); assert.equal(report.abstentionRateSigns, 1);
  assert.equal(report.latencyMs.samples, 0); assert.equal(report.latencyMs.p50, null); assert.equal(report.latencyMs.p95, null);
});

test("missing test classes do not disappear silently from a full-catalog macro F1", () => {
  const corpus = corpusFixture();
  corpus.clips = corpus.clips.filter((clip) => !(clip.split === "test" && clip.labelId === "label-b"));
  const report = evaluateRun(corpus, runFixture(corpus));
  assert.equal(report.macroF1, null); assert.equal(report.macroF1SupportedClasses, 1);
  assert.deepEqual(report.missingTestClasses, ["label-b"]); assert.equal(report.metadataReady, false);
});

test("requires an exact test ledger with the frozen corpus fingerprint", () => {
  const corpus = corpusFixture();
  const missing = runFixture(corpus); missing.results.pop();
  assert.throws(() => evaluateRun(corpus, missing), /incomplete-results/);
  const unknown = runFixture(corpus); unknown.results[0].clipId = "unknown";
  assert.throws(() => evaluateRun(corpus, unknown), /sample-mismatch/);
  const duplicate = runFixture(corpus); duplicate.results[1].clipId = duplicate.results[0].clipId;
  assert.throws(() => evaluateRun(corpus, duplicate), /invalid-format/);
  const mismatch = runFixture(corpus); mismatch.corpusSha256 = "a".repeat(64);
  assert.throws(() => evaluateRun(corpus, mismatch), /corpus-mismatch/);
});

test("keeps model outputs outside a task-specific corpus visible as false proposals", () => {
  const corpus = corpusFixture(); const run = runFixture(corpus);
  run.model.labelIds.push("out-of-scope");
  run.results[0].proposals = [{ labelId: "out-of-scope", visibleAtMs: 1500 }];
  run.results[4].proposals = [{ labelId: "out-of-scope", visibleAtMs: 1000 }];
  run.results[4].observedUntilMs = 60_100;
  run.results[5].observedUntilMs = 60_100;
  const report = evaluateRun(corpus, run);
  assert.equal(report.accuracySigns, 0.75);
  assert.equal(report.counts.outOfScopeProposals, 2);
  assert.equal(report.negativeExposure.falseAlarms, 1);
  assert.equal(report.confusion.counts[0][report.confusion.columns.indexOf("$out-of-scope")], 1);
});

test("rejects malformed visible-event timing, incomplete completed rows and undeclared classes", () => {
  const corpus = corpusFixture();
  const cases = [
    (run) => { run.results[0].proposals[0].visibleAtMs = 3001; },
    (run) => { run.results[0].proposals[0].visibleAtMs = NaN; },
    (run) => { run.results[0].proposals.push(run.results[0].proposals[0]); },
    (run) => { run.results[0].proposals[0].labelId = "unknown"; },
    (run) => { run.results[0].observedUntilMs = 2999; },
    (run) => { run.results[0].observedUntilMs = 8001; },
    (run) => { run.results[0].message = "private-message"; },
    (run) => { run.pipeline.confidenceThreshold = NaN; },
    (run) => { run.pipeline.inputShape = [1, 30, 138, 1]; },
    (run) => { run.pipeline.codeRevision = "unknown-revision"; },
  ];
  for (const change of cases) { const run = runFixture(corpus); change(run); assert.throws(() => evaluateRun(corpus, run), /invalid-format/); }
});

test("blocks evaluation of unauthorized, unreviewed, duplicate or leaking corpus entries instead of scoring them as approved", () => {
  const cases = [
    (corpus) => { corpus.clips[0].authorizationStatus = "pending"; },
    (corpus) => { corpus.clips[0].authorizationStatus = "withdrawn"; },
    (corpus) => { corpus.labels[0].validation = "pending"; },
    (corpus) => { corpus.clips[0].annotationStatus = "pending"; },
    (corpus) => { corpus.clips[4].participantId = corpus.clips[0].participantId; },
    (corpus) => { corpus.clips[4].assetSha256 = corpus.clips[0].assetSha256; },
  ];
  for (const change of cases) { const corpus = corpusFixture(); change(corpus); assert.throws(() => evaluateRun(corpus, runFixture(corpus)), /corpus-not-ready/); }
});
