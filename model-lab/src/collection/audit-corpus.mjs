import { corpusDigest, parseCorpus } from "../evaluation/contracts.mjs";

/** Checks declared metadata only. Does not read videos, consent records or identities. */
export function auditCorpus(input) {
  const corpus = parseCorpus(input);
  const findings = [];
  const add = (code, indices = []) => findings.push({ code, indices });
  if (!corpus.labels.length) add("empty-label-catalog");
  if (!corpus.clips.length) add("empty-corpus");
  corpus.labels.forEach((label, index) => { if (label.validation !== "validated") findings.push({ code: "pending-label-validation", labelIndices: [index] }); });
  const participants = new Map(); const assets = new Map();
  corpus.clips.forEach((clip, index) => {
    const group = participants.get(clip.participantId) ?? { splits: new Set(), indices: [] };
    group.splits.add(clip.split); group.indices.push(index); participants.set(clip.participantId, group);
    const duplicates = assets.get(clip.assetSha256) ?? []; duplicates.push(index); assets.set(clip.assetSha256, duplicates);
    if (clip.authorizationStatus !== "verified") add(clip.authorizationStatus === "withdrawn" ? "withdrawn-authorization" : "pending-authorization", [index]);
    if (clip.annotationStatus !== "reviewed") add("pending-annotation-review", [index]);
  });
  for (const group of participants.values()) if (group.splits.size > 1) add("participant-leakage", group.indices);
  for (const indices of assets.values()) if (indices.length > 1) add("duplicate-clip-hash", indices);
  const coverage = corpus.labels.map(({ id }) => {
    const counts = Object.fromEntries(["train", "validation", "test"].map((split) => [split, corpus.clips.filter((clip) => clip.split === split && clip.labelId === id).length]));
    for (const split of ["train", "validation", "test"]) if (counts[split] === 0) findings.push({ code: `missing-class-in-${split}`, labelIndices: [corpus.labels.findIndex((label) => label.id === id)] });
    return { labelId: id, counts };
  });
  for (const split of ["train", "validation", "test"]) if (!corpus.clips.some((clip) => clip.split === split)) add(`empty-${split}-split`);
  const testNegatives = corpus.clips.filter((clip) => clip.split === "test" && clip.kind !== "sign");
  if (!testNegatives.length) add("missing-test-negatives");
  const distribution = (key) => {
    const counts = new Map();
    for (const clip of corpus.clips) counts.set(clip[key], (counts.get(clip[key]) ?? 0) + 1);
    return [...counts.values()].sort((a, b) => a - b); // No participant/session identifiers in output.
  };
  return {
    schemaVersion: 1, corpusSha256: corpusDigest(corpus), evidence: corpus.evidence,
    metadataReady: findings.length === 0, authorizationAndLanguageVerifiedByTool: false,
    counts: { labels: corpus.labels.length, clips: corpus.clips.length, participants: participants.size,
      testNegatives: testNegatives.length, splits: Object.fromEntries(["train", "validation", "test"].map((split) => [split, corpus.clips.filter((clip) => clip.split === split).length])) },
    coverage, findings,
    samplesPerGroup: Object.fromEntries(["participantId", "sessionId", "variantId", "regionId", "conditionId", "deviceId"].map((key) => [key.replace(/Id$/, ""), distribution(key)])),
    limitations: ["Checks declared metadata, not media readability, source provenance, permissions or LSB validity.", "Row indices refer to the private manifest. No labels or samples are changed or silently excluded."],
  };
}
