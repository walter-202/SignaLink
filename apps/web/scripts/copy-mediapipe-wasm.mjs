import { chmod, copyFile, mkdir, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const mediaPipePackageRoot = dirname(require.resolve("@mediapipe/tasks-vision"));
const sourceDirectory = join(mediaPipePackageRoot, "wasm");
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destinationDirectory = join(webRoot, "public", "mediapipe", "wasm");
const files = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

await rm(destinationDirectory, { recursive: true, force: true });
await mkdir(destinationDirectory, { recursive: true });

let totalBytes = 0;
for (const file of files) {
  const source = join(sourceDirectory, file);
  const { size } = await stat(source);
  const destination = join(destinationDirectory, file);
  await copyFile(source, destination);
  await chmod(destination, 0o644);
  totalBytes += size;
}

console.log(`Copied ${files.length} MediaPipe WASM files (${(totalBytes / 1024 / 1024).toFixed(1)} MiB) to public/mediapipe/wasm.`);
