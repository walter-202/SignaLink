import { chmod, copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const mediaPipePackageRoot = dirname(require.resolve("@mediapipe/tasks-vision"));
const mediaPipePackage = JSON.parse(await readFile(join(mediaPipePackageRoot, "package.json"), "utf8"));
if (mediaPipePackage.version !== "1.1.1") {
  throw new Error("Review the Worker loader and its versioned URL before upgrading MediaPipe from 1.1.1.");
}
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

// Classic worker and IIFE bundle from the SAME pinned package as the main thread.
// Type-only imports in this entry disappear during transpilation; no dependencies
// are fetched from a CDN and no second copy of model weights is generated.
const workerDirectory = join(webRoot, "public", "mediapipe", "1.1.1");
await mkdir(workerDirectory, { recursive: true });
await copyFile(join(mediaPipePackageRoot, "vision_bundle.js"), join(workerDirectory, "vision_bundle.js"));
const workerSource = await readFile(join(webRoot, "src/features/sign-recognition/infrastructure/holistic.worker.ts"), "utf8");
const worker = ts.transpileModule(workerSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
await writeFile(join(workerDirectory, "holistic-worker.js"), worker.outputText);
console.log("Prepared opt-in MediaPipe 1.1.1 classic Worker from local sources.");
