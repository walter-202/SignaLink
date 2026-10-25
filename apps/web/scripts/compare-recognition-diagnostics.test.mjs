import { expect, it } from "vitest";
import { compareRecognitionDiagnostics } from "./compare-recognition-diagnostics.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function report(mode, value = 100) {
  return {
    schemaVersion: 4, pipelineVersion: "continuous-v2", modelId: "synthetic", modelVersion: "fixture-v1", modelSha256: "a".repeat(64),
    featureSchema: "fixture-features", inputShape: [1, 30, 138], runtime: "onnx-wasm", frameIntervalMs: 33, confidenceThreshold: 0.5, minimumMargin: 0,
    landmarkRuntime: { mode, asset: { integrity: "verified", sha256: "b".repeat(64), bytes: 4 } },
    timings: { landmarkMs: { total: 50, samples: 50, mean: value, p50: value, p95: value } },
    messages: "private field that must never appear in the comparison",
  };
}

it("describes a synthetic 50% stage reduction without approving the latency goal or exporting private data", () => {
  const result = compareRecognitionDiagnostics(report("main-thread"), report("worker", 50));
  expect(result.technicalContractsMatch).toBe(true);
  expect(result.stages.find((item) => item.stage === "landmarkMs").reductionPercent).toEqual({ p50: 50, p95: 50 });
  expect(result.latencyGoal50Percent).toBe("not-evaluated");
  expect(result.promotion).toBe("not-evaluated");
  expect(JSON.stringify(result)).not.toContain("private field");
});

it("rejects incompatible contracts, fallback and unverified weights as comparable evidence", () => {
  const candidate = report("worker");
  candidate.confidenceThreshold = 0.8;
  candidate.landmarkRuntime.fallback = "worker-initialization";
  candidate.landmarkRuntime.asset.integrity = "unverified";
  const result = compareRecognitionDiagnostics(report("main-thread"), candidate);
  expect(result.technicalContractsMatch).toBe(false);
  expect(result.issues).toEqual(expect.arrayContaining(["different-confidenceThreshold", "candidate-used-fallback", "unverified-holistic-asset"]));
});

it("does not divide by zero or invent missing measurements", () => {
  const baseline = report("main-thread", 0);
  baseline.timings.landmarkMs.samples = 2;
  const result = compareRecognitionDiagnostics(baseline, report("worker", 1));
  expect(result.stages.find((item) => item.stage === "landmarkMs")).toMatchObject({ status: "few-samples", reductionPercent: { p50: null, p95: null } });
  expect(result.stages.find((item) => item.stage === "inferenceMs").status).toBe("missing-measurements");
});

it("rejects invalid aggregate values and earlier schemas", () => {
  const baseline = report("main-thread");
  for (const invalid of [NaN, -1, Infinity]) {
    const candidate = report("worker"); candidate.timings.landmarkMs.p95 = invalid;
    expect(() => compareRecognitionDiagnostics(baseline, candidate)).toThrow();
  }
  expect(() => compareRecognitionDiagnostics({ ...baseline, schemaVersion: 3 }, report("worker"))).toThrow();
});

it("runs the local CLI with defined exit codes and never prints file paths or oversized contents", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "recognition-cli-"));
  try {
    const baseline = path.join(directory, "baseline.json");
    const candidate = path.join(directory, "candidate.json");
    await writeFile(baseline, JSON.stringify(report("main-thread")));
    await writeFile(candidate, JSON.stringify(report("worker")));
    const script = path.resolve("scripts/compare-recognition-diagnostics.mjs");
    const run = () => spawnSync(process.execPath, [script, baseline, candidate], { encoding: "utf8" });
    const comparable = run();
    expect(comparable.status).toBe(0);
    expect(JSON.parse(comparable.stdout).promotion).toBe("not-evaluated");
    await writeFile(candidate, JSON.stringify(report("main-thread")));
    expect(run().status).toBe(2);
    await writeFile(candidate, "private-content".repeat(10_000));
    const invalid = run();
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).not.toContain(directory);
    expect(invalid.stderr).not.toContain("private-content");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
