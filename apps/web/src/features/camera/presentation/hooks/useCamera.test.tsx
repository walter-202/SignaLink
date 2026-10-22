import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  CameraAccessError,
  type CameraService,
} from "../../application/ports/camera-service";
import { CameraProvider } from "../CameraProvider";
import { useCamera } from "./useCamera";

function createStream() {
  const stop = vi.fn();
  const track = {
    stop,
    addEventListener: vi.fn(),
  } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stop };
}

function createService(overrides: Partial<CameraService> = {}): CameraService {
  return {
    isSupported: () => true,
    open: vi.fn().mockResolvedValue(createStream().stream),
    close: vi.fn(),
    ...overrides,
  };
}

function wrapperFor(service: CameraService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <CameraProvider service={service}>{children}</CameraProvider>;
  };
}

describe("useCamera", () => {
  it("keeps the camera idle until the user starts it and releases the stream on stop", async () => {
    const { stream } = createStream();
    const service = createService({ open: vi.fn().mockResolvedValue(stream) });
    const { result } = renderHook(() => useCamera(), { wrapper: wrapperFor(service) });

    expect(result.current.status).toBe("idle");
    expect(result.current.isActive).toBe(false);
    expect(service.open).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("active");
    expect(result.current.isActive).toBe(true);
    expect(result.current.stream).toBe(stream);

    act(() => result.current.stop());

    expect(service.close).toHaveBeenCalledWith(stream);
    expect(result.current.status).toBe("idle");
    expect(result.current.stream).toBeNull();
  });

  it("shows an actionable message when permission is denied", async () => {
    const service = createService({
      open: vi.fn().mockRejectedValue(new CameraAccessError("not-allowed")),
    });
    const { result } = renderHook(() => useCamera(), { wrapper: wrapperFor(service) });

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("not-allowed");
    expect(result.current.error).toContain("No se autorizó la cámara");
  });

  it("releases the stream when the view unmounts", async () => {
    const { stream } = createStream();
    const service = createService({ open: vi.fn().mockResolvedValue(stream) });
    const { result, unmount } = renderHook(() => useCamera(), { wrapper: wrapperFor(service) });

    await act(async () => {
      await result.current.start();
    });

    unmount();

    expect(service.close).toHaveBeenCalledWith(stream);
  });
});
