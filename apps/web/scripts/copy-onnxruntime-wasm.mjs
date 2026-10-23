import { chmod, copyFile, mkdir, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destinationDirectory = join(webRoot, "public", "onnxruntime", "wasm");
const files = [
  "onnxruntime-web/ort-wasm-simd-threaded.mjs",
  "onnxruntime-web/ort-wasm-simd-threaded.wasm",
];

await rm(destinationDirectory, { recursive: true, force: true });
await mkdir(destinationDirectory, { recursive: true });

let totalBytes = 0;
for (const file of files) {
  const source = require.resolve(file);
  const { size } = await stat(source);
  const destination = join(destinationDirectory, file.split("/").at(-1));
  await copyFile(source, destination);
  await chmod(destination, 0o644);
  totalBytes += size;
}

console.log(`Copied ${files.length} ONNX Runtime WASM files (${(totalBytes / 1024 / 1024).toFixed(1)} MiB) to public/onnxruntime/wasm.`);
