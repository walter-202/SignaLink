import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { corpusFixture, runFixture } from "./fixtures.mjs";

test("paired comparison CLI reports synthetic evidence and sanitizes contract mismatches", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lsb-paired-comparison-"));
  const cli = fileURLToPath(new URL("../src/evaluation/compare-cli.mjs", import.meta.url));
  try {
    const corpus = corpusFixture();
    const baseline = runFixture(corpus); baseline.runId = "synthetic-baseline"; baseline.pipeline.landmarkRuntime = "main-thread";
    const candidate = structuredClone(baseline); candidate.runId = "synthetic-worker"; candidate.pipeline.landmarkRuntime = "worker";
    for (const result of candidate.results) for (const proposal of result.proposals) proposal.visibleAtMs = 1_250;
    const files = ["corpus.json", "baseline.json", "candidate.json"].map((name) => path.join(directory, name));
    await Promise.all([corpus, baseline, candidate].map((input, index) => writeFile(files[index], JSON.stringify(input))));
    const run = () => spawnSync(process.execPath, [cli, ...files], { encoding: "utf8" });
    const success = run();
    assert.equal(success.status, 0);
    const report = JSON.parse(success.stdout);
    assert.equal(report.evidence, "synthetic");
    assert.equal(report.rawThresholds.overallLatencyP50AtLeast50PercentReduction, "not-evaluated");
    assert.equal(report.promotion, "not-evaluated");
    candidate.pipeline.delegate = "GPU";
    await writeFile(files[2], JSON.stringify(candidate));
    const mismatch = run();
    assert.equal(mismatch.status, 2);
    assert.equal(mismatch.stdout, "");
    assert.equal(mismatch.stderr.includes(directory), false);
    assert.equal(mismatch.stderr.includes("test-person-1"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
