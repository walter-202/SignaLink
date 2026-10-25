import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineHolisticModelAsset, loadHolisticModelAsset } from "./holistic-model-asset";

const bytes = new Uint8Array([1, 2, 3, 4]); // Transport fixture, not model weights.
const sha256 = createHash("sha256").update(bytes).digest("hex");
const asset = defineHolisticModelAsset({ url: "/synthetic.task", version: "fixture-v1", sha256, bytes: bytes.length });
const signal = () => new AbortController().signal;

function cacheFixture() {
  const entries = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (key: string) => entries.get(key)?.clone()),
    put: vi.fn(async (key: string, response: Response) => { entries.set(key, response.clone()); }),
    delete: vi.fn(async (key: string | Request) => entries.delete(typeof key === "string" ? key : key.url)),
    keys: vi.fn(async () => [...entries.keys()].map((key) => new Request(key))),
  };
  vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
  return { cache, entries };
}

beforeEach(() => { vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes))); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Holistic model assets", () => {
  it("requires a complete, bounded pin and does not invent a hash for legacy URLs", () => {
    expect(defineHolisticModelAsset({ url: "/legacy.task" }).pin).toBeNull();
    for (const invalid of [
      { version: "fixture-v1" }, { sha256 }, { version: "latest", sha256, bytes: 4 },
      { version: "v1", sha256: "x".repeat(64), bytes: 4 }, { version: "v1", sha256, bytes: 0 },
      { version: "v1", sha256, bytes: 100 * 1024 * 1024 },
    ]) expect(() => defineHolisticModelAsset({ url: "/test.task", ...invalid })).toThrow("model-integrity");
    expect(() => defineHolisticModelAsset({ url: "//untrusted.example/task" })).toThrow("model-load");
  });

  it("verifies a cold read, reuses a verified cache entry and retains only one artifact", async () => {
    const { cache, entries } = cacheFixture();
    entries.set("http://localhost/old.task", new Response(bytes));
    const cold = await loadHolisticModelAsset(asset, signal());
    expect(cold.diagnostics).toMatchObject({ source: "fetch", integrity: "verified", version: "fixture-v1", sha256, bytes: 4 });
    const warm = await loadHolisticModelAsset(asset, signal());
    expect(warm.diagnostics).toMatchObject({ source: "cache-storage", integrity: "verified", sha256 });
    expect(new Uint8Array(warm.buffer)).toEqual(bytes);
    expect(fetch).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledOnce();
    expect(entries.size).toBe(1);
    expect([...entries.keys()][0]).not.toContain("synthetic.task");
  });

  it("rechecks cache bytes, evicts corruption and refuses bad replacement bytes", async () => {
    const { entries, cache } = cacheFixture();
    await loadHolisticModelAsset(asset, signal());
    const key = [...entries.keys()][0]!;
    entries.set(key, new Response(new Uint8Array([4, 3, 2, 1])));
    const recovered = await loadHolisticModelAsset(asset, signal());
    expect(recovered.diagnostics.source).toBe("fetch");
    expect(cache.delete).toHaveBeenCalledWith(key);
    entries.set(key, new Response(new Uint8Array([4, 3, 2, 1])));
    vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array([4, 3, 2, 1])));
    await expect(loadHolisticModelAsset(asset, signal())).rejects.toMatchObject({ code: "model-integrity" });
    expect(entries.size).toBe(0);
  });

  it("does not hand short, oversized or HTTP-error bodies to MediaPipe or cache them", async () => {
    const { cache } = cacheFixture();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array([1])))
      .mockResolvedValueOnce(new Response(new Uint8Array(5)))
      .mockResolvedValueOnce(new Response(bytes, { headers: { "content-length": "99999999" } }))
      .mockResolvedValueOnce(new Response("no", { status: 404 }));
    for (let i = 0; i < 3; i++) await expect(loadHolisticModelAsset(asset, signal())).rejects.toMatchObject({ code: "model-integrity" });
    await expect(loadHolisticModelAsset(asset, signal())).rejects.toMatchObject({ code: "model-load" });
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("still verifies when CacheStorage is unavailable and does not persist unpinned weights", async () => {
    const open = vi.fn(async () => { throw new Error("Private mode"); });
    vi.stubGlobal("caches", { open });
    const loaded = await loadHolisticModelAsset(asset, signal());
    expect(loaded.diagnostics.integrity).toBe("verified");
    open.mockClear();
    const legacy = await loadHolisticModelAsset(defineHolisticModelAsset({ url: "/legacy.task" }), signal());
    expect(legacy.diagnostics.integrity).toBe("unverified");
    expect(open).not.toHaveBeenCalled();
  });

  it("cancels during hashing without storing or returning the bytes", async () => {
    const { cache } = cacheFixture();
    let finish!: (digest: ArrayBuffer) => void;
    const digest = vi.fn(() => new Promise<ArrayBuffer>((resolve) => { finish = resolve; }));
    vi.stubGlobal("crypto", { subtle: { digest } });
    const controller = new AbortController();
    const pending = loadHolisticModelAsset(asset, controller.signal);
    await vi.waitFor(() => expect(digest).toHaveBeenCalledOnce());
    controller.abort();
    finish(new Uint8Array(Buffer.from(sha256, "hex")).buffer);
    await expect(pending).rejects.toMatchObject({ code: "closed" });
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("cancels a streaming body and avoids all work for an already cancelled request", async () => {
    const pull = vi.fn();
    const cancel = vi.fn();
    vi.mocked(fetch).mockResolvedValue(new Response(new ReadableStream({ pull, cancel })));
    const controller = new AbortController();
    const pending = loadHolisticModelAsset(asset, controller.signal);
    await vi.waitFor(() => expect(pull).toHaveBeenCalled());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "closed" });
    expect(cancel).toHaveBeenCalled();
    vi.mocked(fetch).mockClear();
    await expect(loadHolisticModelAsset(asset, controller.signal)).rejects.toMatchObject({ code: "closed" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
