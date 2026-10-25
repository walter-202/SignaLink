import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditCorpus } from "../src/collection/audit-corpus.mjs";
import { evaluateRun } from "../src/evaluation/evaluate-run.mjs";

test("checked-in examples are explicitly synthetic, have a matching digest and the empty template is not ready", async () => {
  const read = async (relative) => JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
  const [corpus, run, template] = await Promise.all([read("../examples/synthetic-corpus.json"), read("../examples/synthetic-run.json"), read("../configs/corpus.template.json")]);
  const report = evaluateRun(corpus, run);
  assert.equal(report.evidence, "synthetic"); assert.equal(report.latencyGoal50Percent, "not-evaluated");
  assert.equal(report.corpusSha256, run.corpusSha256);
  assert.equal(auditCorpus(template).metadataReady, false);
});
