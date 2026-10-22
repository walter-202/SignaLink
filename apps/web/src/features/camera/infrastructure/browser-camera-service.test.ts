import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserCameraService } from "./browser-camera-service";

type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

const originalMediaDevices = navigator.mediaDevices;
const originalSecureContext = window.isSecureContext;

function setSecureContext(value: boolean) {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value });
}

function setMediaDevices(getUserMedia: GetUserMedia) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

function createStream() {
  const stop = vi.fn();
  const track = { stop } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stop };
}

afterEach(() => {
  if (originalMediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: originalSecureContext });
  vi.restoreAllMocks();
});

describe("BrowserCameraService", () => {
  it("opens the user camera with ideal dimensions and releases all tracks", async () => {
    setSecureContext(true);
    const { stream, stop } = createStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream) as unknown as GetUserMedia;
    setMediaDevices(getUserMedia);
    const service = new BrowserCameraService();

    const result = await service.open({ width: 1280, height: 720 });

    expect(result).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    service.close(result);
    expect(stop).toHaveBeenCalledOnce();
  });

  it.each([
    ["NotAllowedError", "not-allowed"],
    ["NotFoundError", "not-found"],
    ["NotReadableError", "in-use"],
    ["SecurityError", "not-allowed"],
  ] as const)("maps %s to %s", async (name, code) => {
    setSecureContext(true);
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("failed", name)) as unknown as GetUserMedia;
    setMediaDevices(getUserMedia);

    await expect(new BrowserCameraService().open()).rejects.toMatchObject({ code });
  });

  it("reports an insecure context before requesting the camera", async () => {
    setSecureContext(false);
    const getUserMedia = vi.fn() as unknown as GetUserMedia;
    setMediaDevices(getUserMedia);

    await expect(new BrowserCameraService().open()).rejects.toMatchObject({ code: "insecure-context" });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("reports unsupported browsers without calling media devices", async () => {
    setSecureContext(true);
    Reflect.deleteProperty(navigator, "mediaDevices");
    const service = new BrowserCameraService();

    expect(service.isSupported()).toBe(false);
    await expect(service.open()).rejects.toMatchObject({ code: "not-supported" });
  });

  it("retries with default constraints when the requested ones are rejected", async () => {
    setSecureContext(true);
    const { stream } = createStream();
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new DOMException("constraints", "OverconstrainedError"))
      .mockResolvedValueOnce(stream) as unknown as GetUserMedia;
    setMediaDevices(getUserMedia);

    await expect(new BrowserCameraService().open({ facingMode: "environment" })).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: false, video: true });
  });
});
