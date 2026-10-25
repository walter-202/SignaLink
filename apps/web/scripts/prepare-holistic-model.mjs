import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Local-only provisioning. Expected metadata must come from a reviewed source;
// computing a digest is not linguistic validation or provenance verification.
const [source, version, expectedSha, sizeText] = process.argv.slice(2);
const bytes = Number(sizeText);
const sha256 = expectedSha?.toLowerCase();
if (!source || !version || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(version) || version === "latest"
  || !sha256 || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 64 * 1024 * 1024) {
  throw new Error("Usage: pnpm prepare:holistic <local.task> <reviewed-version> <expected-sha256> <expected-bytes>");
}
const sourcePath = resolve(source);
const info = await stat(sourcePath);
if (!info.isFile() || info.size !== bytes) throw new Error("Holistic size does not match the reviewed metadata.");
const data = await readFile(sourcePath);
if (data.length !== bytes || createHash("sha256").update(data).digest("hex") !== sha256) {
  throw new Error("Holistic SHA-256 does not match the reviewed metadata.");
}
// .task is a ZIP bundle. This sanity check does not prove semantic compatibility.
if (data[0] !== 0x50 || data[1] !== 0x4b) throw new Error("Expected a MediaPipe .task ZIP bundle.");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = `/models/holistic/${version}/${sha256}/holistic_landmarker.task`;
const destination = join(root, "public", url);
await mkdir(dirname(destination), { recursive: true });
const temporary = `${destination}.${process.pid}.tmp`;
try {
  // Write the already verified bytes, avoiding a source-file change between
  // validation and copying. Atomic rename prevents exposing a partial artifact.
  await writeFile(temporary, data, { mode: 0o644 });
  await rename(temporary, destination);
} finally { await rm(temporary, { force: true }); }
await writeFile(join(dirname(destination), "manifest.json"), `${JSON.stringify({ url, version, sha256, bytes }, null, 2)}\n`);
console.log(`Prepared verified local Holistic bundle (${bytes} bytes). Add these public values to the app configuration:\nNEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_URL=${url}\nNEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_VERSION=${version}\nNEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_SHA256=${sha256}\nNEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_BYTES=${bytes}`);
