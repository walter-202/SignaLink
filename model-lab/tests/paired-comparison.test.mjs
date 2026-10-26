import { test } from "node:test";
import assert from "node:assert/strict";
import { compareRuns } from "../src/evaluation/compare-runs.mjs";
import { corpusFixture, runFixture } from "./fixtures.mjs";

function pair() {
  const corpus = corpusFixture();
  const baseline = runFixture(corpus);
  baseline.runId = "synthetic-baseline";
  baseline.pipeline.landmarkRuntime = "main-thread";
  const candidate = structuredClone(baseline);
  candidate.runId = "synthetic-worker";
  candidate.pipeline.landmarkRuntime = "worker";
  for (const result of candidate.results) {
    for (const proposal of result.proposals) proposal.visibleAtMs = 1_250;
  }
  return { corpus, baseline, candidate };
}

test("compares paired synthetic arms without converting raw ratios into promotion", () => {
  const { corpus, baseline, candidate } = pair();
  const report = compareRuns(corpus, baseline, candidate);
  assert.equal(report.comparable, true);
  assert.equal(report.evidence, "synthetic");
  assert.equal(report.changes.overallLatencyRatio.p50, 0.5);
  assert.equal(report.changes.overallLatencyRatio.p95, 0.5);
  assert.equal(report.paired.correctInBothSamples, 4);
  assert.equal(report.paired.relativeLatencyRatio.samples, 4);
  assert.equal(report.paired.relativeLatencyRatio.p50, 0.5);
  assert.equal(report.candidate.macroF1, 1);
  assert.equal(report.rawThresholds.overallLatencyP50AtLeast50PercentReduction, "not-evaluated");
  assert.equal(report.promotion, "not-evaluated");
  assert.equal(JSON.stringify(report).includes("test-person-1"), false);
});

test("rejects mismatched device, delegate, preprocessing, or engine direction", () => {
  const changes = [
    (candidate) => { candidate.deviceProfileId = "other-device"; },
    (candidate) => { candidate.pipeline.delegate = "GPU"; },
    (candidate) => { candidate.pipeline.preprocessorId = "other-preprocessor"; },
    (candidate) => { candidate.pipeline.landmarkRuntime = "main-thread"; },
  ];
  for (const change of changes) {
    const { corpus, baseline, candidate } = pair(); change(candidate);
    assert.throws(() => compareRuns(corpus, baseline, candidate), /comparison-mismatch/);
  }
});

test("keeps quality loss and mistakes visible even when paired latency improves", () => {
  const { corpus, baseline, candidate } = pair();
  candidate.results[0].proposals = [{ labelId: "label-b", visibleAtMs: 1_250 }];
  const report = compareRuns(corpus, baseline, candidate);
  assert.ok(report.changes.macroF1DropPercentagePoints < 0);
  assert.equal(report.paired.correctInBothSamples, 3);
  assert.equal(report.promotion, "not-evaluated");
});
