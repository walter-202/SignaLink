import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, open, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { auditCorpus } from "../collection/audit-corpus.mjs";
import { EvaluationInputError, parseCorpus } from "../evaluation/contracts.mjs";

const MAX_CONFIG_BYTES = 1024 * 1024;
const MAX_PRIVATE_CLIP_BYTES = 64 * 1024 * 1024;
const MAX_HOLISTIC_BYTES = 64 * 1024 * 1024;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const SHA = /^[a-f0-9]{64}$/;
const CONFIG_KEYS = ["schemaVersion", "corpusPath", "clipFiles", "modelLabelMap", "deviceProfileId", "browserProfileId", "holisticAsset", "runs"];
const CONFIG_DIR = path.join("model-lab", "datasets", "private");
const OUTPUT_DIR = path.join("model-lab", "reports", "private");
const PRIVATE_CLIPS_DIR = path.join(CONFIG_DIR, "clips");

function fail(code = "invalid-run-config") {
  throw new EvaluationInputError(code);
}

function assertObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) fail();
}

function assertOpaque(value) {
  if (typeof value !== "string" || !ID.test(value)) fail();
}

function safeRelative(value, allowedPrefix = null) {
  if (typeof value !== "string" || !value || path.isAbsolute(value) || value.includes("\\")) fail();
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) fail();
  const normalized = path.posix.normalize(value);
  if (allowedPrefix && !normalized.startsWith(`${allowedPrefix}/`)) fail();
  return normalized;
}

async function readLimitedJson(file, limit) {
  const info = await stat(file).catch(() => fail("private-data-not-ready"));
  if (!info.isFile() || info.size > limit) fail("invalid-run-config");
  try { return JSON.parse(await readFile(file, "utf8")); } catch { fail("invalid-run-config"); }
}

async function hashFile(file, maxBytes) {
  const info = await stat(file).catch(() => fail("private-asset-unavailable"));
  if (!info.isFile() || info.size <= 0 || info.size > maxBytes) fail("invalid-private-asset");
  const hash = createHash("sha256");
  try {
    for await (const chunk of createReadStream(file)) hash.update(chunk);
  } catch {
    fail("private-asset-unavailable");
  }
  return { bytes: info.size, sha256: hash.digest("hex") };
}

function gitMetadata(repoRoot) {
  const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" });
  if (revision.status !== 0 || status.status !== 0 || !/^[a-f0-9]{40}\s*$/.test(revision.stdout)) fail("repository-not-ready");
  if (status.stdout.trim()) fail("repository-not-clean");
  return revision.stdout.trim();
}

export function validateRunnerConfig(config, corpus) {
  assertObject(config, CONFIG_KEYS);
  if (config.schemaVersion !== 1) fail();
  const labels = new Set(corpus.labels.map((label) => label.id));
  assertObject(config.holisticAsset, ["version", "sha256", "bytes"]);
  if (typeof config.holisticAsset.version !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(config.holisticAsset.version)
    || config.holisticAsset.version === "latest" || typeof config.holisticAsset.sha256 !== "string" || !SHA.test(config.holisticAsset.sha256)
    || !Number.isSafeInteger(config.holisticAsset.bytes) || config.holisticAsset.bytes <= 0 || config.holisticAsset.bytes > MAX_HOLISTIC_BYTES) fail();
  assertOpaque(config.deviceProfileId);
  assertOpaque(config.browserProfileId);
  if (!config.modelLabelMap || typeof config.modelLabelMap !== "object" || Array.isArray(config.modelLabelMap)
    || Object.keys(config.modelLabelMap).length === 0 || Object.keys(config.modelLabelMap).length > 256) fail();
  const mappedLabels = new Set();
  for (const [modelLabel, labelId] of Object.entries(config.modelLabelMap)) {
    if (typeof modelLabel !== "string" || modelLabel.length < 1 || modelLabel.length > 100 || /[\u0000-\u001f]/.test(modelLabel)) fail();
    assertOpaque(labelId);
    if (!labels.has(labelId)) fail();
    mappedLabels.add(labelId);
  }
  if ([...labels].some((label) => !mappedLabels.has(label))) fail("incomplete-model-label-map");
  if (!Array.isArray(config.runs) || config.runs.length !== 2) fail();
  const modes = new Set();
  const runIds = new Set();
  for (const run of config.runs) {
    assertObject(run, ["runId", "landmarkRuntime", "condition"]);
    assertOpaque(run.runId);
    if (runIds.has(run.runId)) fail();
    runIds.add(run.runId);
    if (!["main-thread", "worker"].includes(run.landmarkRuntime) || run.condition !== "warm") fail();
    modes.add(run.landmarkRuntime);
  }
  if (modes.size !== 2) fail();
  return [...runIds];
}

/** Fails before measurement when either output path could overwrite prior evidence. */
export async function assertPrivateRunOutputsAvailable(repoRoot, runIds) {
  const root = await realpath(repoRoot);
  const reportsRoot = path.join(root, OUTPUT_DIR);
  for (const runId of runIds) {
    assertOpaque(runId);
    try {
      await lstat(path.join(reportsRoot, `${runId}.json`));
      fail("report-already-exists");
    } catch (cause) {
      if (cause instanceof EvaluationInputError) throw cause;
      if (cause?.code !== "ENOENT") fail("report-write-failed");
    }
  }
}

/** Loads a private run config and verifies every local asset before Chromium sees it. */
export async function loadRunnerInputs(configPath, repoRoot) {
  const root = await realpath(repoRoot);
  const privateRoot = await realpath(path.join(root, CONFIG_DIR)).catch(() => fail("private-data-not-ready"));
  const resolvedConfig = await realpath(configPath).catch(() => fail("invalid-run-config"));
  if (!resolvedConfig.startsWith(`${privateRoot}${path.sep}`)) fail("invalid-run-config");
  const config = await readLimitedJson(resolvedConfig, MAX_CONFIG_BYTES);
  const corpusRelative = safeRelative(config.corpusPath);
  const corpusPath = path.resolve(privateRoot, corpusRelative);
  const actualCorpus = await realpath(corpusPath).catch(() => fail("private-data-not-ready"));
  if (!actualCorpus.startsWith(`${privateRoot}${path.sep}`)) fail();
  const corpusInput = await readLimitedJson(actualCorpus, 8 * 1024 * 1024);
  const corpus = parseCorpus(corpusInput);
  if (corpus.evidence !== "recorded") fail("recorded-corpus-required");
  const audit = auditCorpus(corpus);
  if (!audit.metadataReady) fail("corpus-not-ready");
  const codeRevision = gitMetadata(root);
  const runIds = validateRunnerConfig(config, corpus);
  await assertPrivateRunOutputsAvailable(root, runIds);
  const testClips = corpus.clips.filter((clip) => clip.split === "test");
  if (!testClips.length) fail("corpus-not-ready");
  if (!config.clipFiles || typeof config.clipFiles !== "object" || Array.isArray(config.clipFiles)) fail();
  const mappedClipIds = Object.keys(config.clipFiles);
  if (mappedClipIds.length !== testClips.length || testClips.some((clip) => !Object.hasOwn(config.clipFiles, clip.id))) fail("private-assets-incomplete");
  const clipRoot = await realpath(path.join(root, PRIVATE_CLIPS_DIR)).catch(() => fail("private-data-not-ready"));
  const clips = new Map();
  for (const clip of testClips) {
    const relative = safeRelative(config.clipFiles[clip.id], "clips");
    const requested = path.resolve(privateRoot, relative);
    const localPath = await realpath(requested).catch(() => fail("private-assets-incomplete"));
    if (!localPath.startsWith(`${clipRoot}${path.sep}`)) fail();
    const extension = path.extname(localPath).toLowerCase();
    const contentType = extension === ".mp4" ? "video/mp4" : extension === ".webm" ? "video/webm" : null;
    if (!contentType) fail("unsupported-clip-format");
    const digest = await hashFile(localPath, MAX_PRIVATE_CLIP_BYTES);
    if (digest.sha256 !== clip.assetSha256) fail("private-asset-hash-mismatch");
    if (clip.kind === "sign" && (clip.onsetMs < 1_000 || clip.durationMs - clip.endMs < 1_500)) fail("insufficient-clip-context");
    const file = await open(localPath, "r").catch(() => fail("private-asset-unavailable"));
    const header = Buffer.alloc(12);
    try { await file.read(header, 0, header.length, 0); } finally { await file.close(); }
    if (contentType === "video/mp4" ? header.toString("ascii", 4, 8) !== "ftyp" : !header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) fail("unsupported-clip-format");
    clips.set(clip.id, { path: localPath, contentType, bytes: digest.bytes, durationMs: clip.durationMs });
  }
  const modelUrl = `/models/holistic/${config.holisticAsset.version}/${config.holisticAsset.sha256}/holistic_landmarker.task`;
  const holisticPath = path.join(root, "apps", "web", "public", modelUrl.slice(1));
  const holisticDigest = await hashFile(holisticPath, MAX_HOLISTIC_BYTES).catch(() => fail("holistic-model-not-ready"));
  if (holisticDigest.bytes !== config.holisticAsset.bytes || holisticDigest.sha256 !== config.holisticAsset.sha256) fail("holistic-model-integrity");
  return {
    config: structuredClone(config), corpus, corpusSha256: audit.corpusSha256, clips,
    holistic: { url: modelUrl, ...config.holisticAsset },
    codeRevision, runIds, repoRoot: root,
  };
}

/** Creates the private reports directory without exposing or logging its path. */
export async function writePrivateRun(repoRoot, runId, run) {
  assertOpaque(runId);
  const root = await realpath(repoRoot);
  const outputRoot = path.join(root, OUTPUT_DIR);
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const actualOutputRoot = await realpath(outputRoot).catch(() => fail("report-write-failed"));
  if (actualOutputRoot !== outputRoot) fail("report-write-failed");
  const output = path.join(outputRoot, `${runId}.json`);
  try {
    await writeFile(output, `${JSON.stringify(run, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  } catch { fail("report-write-failed"); }
}

/** Stores a paired comparison beside its ledgers without replacing prior evidence. */
export async function writePrivateComparison(repoRoot, baselineRunId, candidateRunId, comparison) {
  assertOpaque(baselineRunId);
  assertOpaque(candidateRunId);
  if (baselineRunId === candidateRunId
    || comparison?.baseline?.runId !== baselineRunId
    || comparison?.candidate?.runId !== candidateRunId) fail("invalid-comparison-report");
  const root = await realpath(repoRoot);
  const outputRoot = path.join(root, OUTPUT_DIR);
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const actualOutputRoot = await realpath(outputRoot).catch(() => fail("report-write-failed"));
  if (actualOutputRoot !== outputRoot) fail("report-write-failed");
  const filename = `comparison-${baselineRunId}-${candidateRunId}.json`;
  try {
    await writeFile(path.join(outputRoot, filename), `${JSON.stringify(comparison, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  } catch { fail("report-write-failed"); }
  return filename;
}
