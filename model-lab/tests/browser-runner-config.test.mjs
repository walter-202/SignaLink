import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertPrivateRunOutputsAvailable, validateRunnerConfig, writePrivateComparison } from "../src/browser/runner-config.mjs";
import { corpusFixture } from "./fixtures.mjs";

function config() {
  return {
    schemaVersion: 1, corpusPath: "corpus-v1.json",
    clipFiles: { "test-a1": "clips/a.mp4", "test-a2": "clips/b.mp4", "test-b1": "clips/c.mp4", "test-b2": "clips/d.mp4", rest: "clips/e.mp4", movement: "clips/f.mp4" },
    modelLabelMap: { HOLA: "label-a", GRACIAS: "label-b" },
    deviceProfileId: "office-device", browserProfileId: "chromium-desktop",
    holisticAsset: { version: "reviewed-v1", sha256: "a".repeat(64), bytes: 4 },
    runs: [
      { runId: "baseline-01", landmarkRuntime: "main-thread", condition: "warm" },
      { runId: "worker-01", landmarkRuntime: "worker", condition: "warm" },
    ],
  };
}

test("accepts only a paired warm baseline and Worker plan with complete corpus label mapping", () => {
  assert.deepEqual(validateRunnerConfig(config(), corpusFixture()), ["baseline-01", "worker-01"]);
});

test("rejects run IDs whose private evidence files already exist", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "signlink-model-lab-"));
  try {
    const reports = path.join(repoRoot, "model-lab/reports/private");
    await mkdir(reports, { recursive: true });
    await writeFile(path.join(reports, "baseline-01.json"), "{}");
    await assert.rejects(assertPrivateRunOutputsAvailable(repoRoot, ["baseline-01", "worker-01"]), /report-already-exists/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("rejects incomplete mappings, unpaired engines, unknown settings and unsafe run identifiers", () => {
  const changes = [
    (value) => { delete value.modelLabelMap.GRACIAS; },
    (value) => { value.runs[1].landmarkRuntime = "main-thread"; },
    (value) => { value.extra = "ignored"; },
    (value) => { value.runs[0].runId = "../report"; },
    (value) => { value.runs[0].condition = "cold"; },
  ];
  for (const change of changes) {
    const value = config(); change(value);
    assert.throws(() => validateRunnerConfig(value, corpusFixture()));
  }
});

test("writes private paired comparison once and refuses mismatched IDs or overwrites", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "signlink-model-lab-"));
  const comparison = {
    baseline: { runId: "baseline-01" },
    candidate: { runId: "worker-01" },
    promotion: "not-evaluated",
  };
  try {
    const filename = await writePrivateComparison(repoRoot, "baseline-01", "worker-01", comparison);
    assert.equal(filename, "comparison-baseline-01-worker-01.json");
    const saved = JSON.parse(await readFile(path.join(repoRoot, "model-lab/reports/private", filename), "utf8"));
    assert.deepEqual(saved, comparison);
    await assert.rejects(writePrivateComparison(repoRoot, "baseline-01", "worker-01", comparison), /report-write-failed/);
    await assert.rejects(writePrivateComparison(repoRoot, "baseline-01", "other-worker", comparison), /invalid-comparison-report/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
