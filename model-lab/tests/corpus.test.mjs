import { test } from "node:test";
import assert from "node:assert/strict";
import { corpusDigest, parseCorpus } from "../src/evaluation/contracts.mjs";
import { auditCorpus } from "../src/collection/audit-corpus.mjs";
import { corpusFixture } from "./fixtures.mjs";

test("audits coverage and disjoint metadata without certifying real permissions or exposing participant IDs", () => {
  const corpus = corpusFixture();
  const report = auditCorpus(corpus);
  assert.equal(report.metadataReady, true);
  assert.equal(report.authorizationAndLanguageVerifiedByTool, false);
  assert.deepEqual(report.counts, { labels: 2, clips: 10, participants: 4, testNegatives: 2, splits: { train: 2, validation: 2, test: 6 } });
  assert.deepEqual(report.coverage[0].counts, { train: 1, validation: 1, test: 2 });
  assert.equal(JSON.stringify(report).includes("test-person-1"), false);
  assert.equal(JSON.stringify(report).includes("synthetic-permission"), false);
});

test("reports cross-partition participants, duplicate clip bytes and unresolved review without modifying data", () => {
  const corpus = corpusFixture();
  corpus.clips[4].participantId = corpus.clips[0].participantId;
  corpus.clips[4].assetSha256 = corpus.clips[0].assetSha256;
  corpus.clips[4].authorizationStatus = "withdrawn";
  corpus.clips[4].annotationStatus = "pending";
  corpus.labels[0].validation = "pending";
  const before = JSON.stringify(corpus);
  const report = auditCorpus(corpus);
  assert.equal(report.metadataReady, false);
  for (const code of ["participant-leakage", "duplicate-clip-hash", "withdrawn-authorization", "pending-annotation-review", "pending-label-validation"]) assert.ok(report.findings.some((item) => item.code === code));
  assert.deepEqual(report.findings.find((item) => item.code === "duplicate-clip-hash").indices, [0, 4]);
  assert.equal(JSON.stringify(corpus), before);
});

test("a draft or missing test class is not ready", () => {
  const corpus = corpusFixture();
  corpus.clips = corpus.clips.filter((clip) => !(clip.split === "test" && clip.labelId === "label-b"));
  const report = auditCorpus(corpus);
  assert.equal(report.metadataReady, false);
  assert.ok(report.findings.some((item) => item.code === "missing-class-in-test"));
  const empty = auditCorpus({ ...corpus, labels: [], clips: [] });
  assert.equal(empty.metadataReady, false);
  assert.ok(empty.findings.some((item) => item.code === "empty-corpus"));
});

test("rejects malformed intervals, IDs, duplicated rows, unknown fields and labels", () => {
  const cases = [
    (input) => { input.clips[0].onsetMs = -1; },
    (input) => { input.clips[0].endMs = input.clips[0].onsetMs; },
    (input) => { input.clips[0].durationMs = NaN; },
    (input) => { input.clips[0].labelId = "unknown"; },
    (input) => { input.clips[0].participantId = "invalid with spaces"; },
    (input) => { input.clips.push(input.clips[0]); },
    (input) => { input.clips[0].participantName = "must-not-accept"; },
    (input) => { input.clips[8].labelId = "label-a"; },
  ];
  for (const change of cases) { const corpus = corpusFixture(); change(corpus); assert.throws(() => parseCorpus(corpus), /invalid-format/); }
});

test("fingerprints are invariant to whitespace/object key order but track annotation changes", () => {
  const corpus = corpusFixture();
  const hash = corpusDigest(corpus);
  assert.equal(corpusDigest(JSON.parse(JSON.stringify(corpus, null, 4))), hash);
  assert.equal(corpusDigest(Object.fromEntries(Object.entries(corpus).reverse())), hash);
  corpus.clips[4].onsetMs = 900;
  assert.notEqual(corpusDigest(corpus), hash);
});
