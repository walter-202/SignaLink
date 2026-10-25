import { LandmarkDetectorError } from "../application/ports/landmark-detector";
import type { HolisticModelAsset, HolisticAssetDiagnostics } from "../domain/holistic-model-asset";

export const DEFAULT_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task";
const CACHE_NAME = "signalink-holistic-assets-v1";
const MAX_BYTES = 64 * 1024 * 1024;

export function defineHolisticModelAsset(input: { url: string; version?: string; sha256?: string; bytes?: string | number }): HolisticModelAsset {
  const { url } = input;
  if (!url || !(url.startsWith("/") && !url.startsWith("//") || /^https:\/\//.test(url))) {
    throw new LandmarkDetectorError("model-load");
  }
  const version = input.version?.trim();
  const sha256 = input.sha256?.trim().toLowerCase();
  const bytes = input.bytes === undefined || input.bytes === "" ? undefined : Number(input.bytes);
  const configured = Boolean(version || sha256 || bytes !== undefined);
  if (!configured) return Object.freeze({ url, pin: null });
  if (!version || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(version) || version === "latest"
    || !sha256 || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(bytes) || bytes! <= 0 || bytes! > MAX_BYTES) {
    throw new LandmarkDetectorError("model-integrity");
  }
  return Object.freeze({ url, pin: Object.freeze({ version, sha256, bytes: bytes! }) });
}

export function configuredHolisticModelAsset(urlOverride?: string): HolisticModelAsset {
  return defineHolisticModelAsset({
    url: urlOverride ?? (process.env.NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_URL?.trim() || DEFAULT_MODEL_URL),
    version: process.env.NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_VERSION,
    sha256: process.env.NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_SHA256,
    bytes: process.env.NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_BYTES,
  });
}

function checkCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new LandmarkDetectorError("closed");
}

async function readBounded(response: Response, limit: number, signal: AbortSignal, exactSize = false): Promise<ArrayBuffer> {
  if (!response.ok || !response.body) throw new LandmarkDetectorError("model-load");
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > limit) {
    await response.body.cancel();
    throw new LandmarkDetectorError("model-integrity");
  }
  const reader = response.body.getReader();
  const abortRead = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abortRead, { once: true });
  const chunks: Uint8Array[] = [];
  const target = exactSize ? new Uint8Array(limit) : null;
  let size = 0;
  try {
    while (true) {
      checkCancelled(signal);
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new LandmarkDetectorError("model-integrity");
      if (target) target.set(value, size - value.byteLength);
      else chunks.push(value);
    }
    checkCancelled(signal);
    if (target) return size === target.length ? target.buffer : target.slice(0, size).buffer;
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
    return data.buffer;
  } finally {
    signal.removeEventListener("abort", abortRead);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function verify(buffer: ArrayBuffer, asset: HolisticModelAsset, signal: AbortSignal): Promise<void> {
  checkCancelled(signal);
  if (!buffer.byteLength) throw new LandmarkDetectorError("model-integrity");
  if (!asset.pin) return;
  if (buffer.byteLength !== asset.pin.bytes) throw new LandmarkDetectorError("model-integrity");
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  checkCancelled(signal);
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== asset.pin.sha256) throw new LandmarkDetectorError("model-integrity");
}

/** CacheStorage contains only pinned model weights, never camera or session data.
 * Every cache read is verified again. Unpinned assets use HTTP caching only. */
export async function loadHolisticModelAsset(input: HolisticModelAsset, signal: AbortSignal): Promise<{ buffer: ArrayBuffer; diagnostics: HolisticAssetDiagnostics }> {
  checkCancelled(signal);
  const asset = defineHolisticModelAsset({ url: input.url, ...input.pin });
  const startedAt = performance.now();
  let cache: Cache | undefined;
  // Content address + version; no remote URL, auth token or signed query in keys.
  const key = asset.pin ? new URL(`/__signalink-model-cache/holistic/${asset.pin.version}/${asset.pin.sha256}.task`, location.origin).href : null;
  if (key && typeof caches !== "undefined") {
    try { cache = await caches.open(CACHE_NAME); } catch { /* Private mode/quota: use verified HTTP reads. */ }
  }
  checkCancelled(signal);
  if (cache && key) {
    let cached: Response | undefined;
    try { cached = await cache.match(key); } catch { /* Continue with HTTP cache/network. */ }
    if (cached) {
      try {
        const buffer = await readBounded(cached, asset.pin!.bytes, signal, true);
        const readAt = performance.now();
        await verify(buffer, asset, signal);
        return { buffer, diagnostics: { integrity: "verified", source: "cache-storage", ...asset.pin!, bytes: buffer.byteLength, readMs: readAt - startedAt, integrityMs: performance.now() - readAt } };
      } catch (cause) {
        checkCancelled(signal);
        // A corrupt cache entry cannot be handed to MediaPipe.
        try { await cache.delete(key); } catch { /* Cache is optional. */ }
        if (cause instanceof LandmarkDetectorError && cause.code === "closed") throw cause;
      }
    }
  }
  checkCancelled(signal);
  const response = await fetch(asset.url, { cache: "force-cache", credentials: "omit", signal });
  const buffer = await readBounded(response, asset.pin?.bytes ?? MAX_BYTES, signal, asset.pin !== null);
  const readAt = performance.now();
  await verify(buffer, asset, signal);
  const integrityMs = performance.now() - readAt;
  if (cache && key) {
    checkCancelled(signal);
    try {
      // Keep a single current artifact in this dedicated cache. Cache failures
      // never convert invalid bytes into a successful load.
      for (const request of await cache.keys()) if (request.url !== key) await cache.delete(request);
      checkCancelled(signal);
      await cache.put(key, new Response(buffer));
    } catch { checkCancelled(signal); }
  }
  checkCancelled(signal);
  return { buffer, diagnostics: { integrity: asset.pin ? "verified" : "unverified", source: "fetch", version: asset.pin?.version, sha256: asset.pin?.sha256, bytes: buffer.byteLength, readMs: readAt - startedAt, integrityMs } };
}
