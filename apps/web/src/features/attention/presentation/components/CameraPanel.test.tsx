import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LandmarkFrame, LandmarkPoint } from "@/features/sign-recognition/domain/landmarks";

const classifierMocks = vi.hoisted(() => ({
  initialize: vi.fn(async () => undefined),
  classify: vi.fn<(sequence: Float32Array[]) => Promise<{ label: string; classIndex: number; confidence: number }>>(async () => ({
    label: "HOLA",
    classIndex: 39,
    confidence: 0.91,
  })),
  close: vi.fn(),
}));

function createHand(offsetX: number): LandmarkPoint[] {
  return Array.from({ length: 21 }, (_, index) => ({
    x: offsetX + index * 0.001,
    y: 0.2 + index * 0.001,
    z: 0,
  }));
}

function createLandmarks(offsetX: number): LandmarkFrame {
  return {
    pose: null,
    leftHand: null,
    rightHand: createHand(offsetX),
    timestampMs: 0,
  };
}

function createFeatures(seed = 0): Float32Array {
  const features = new Float32Array(138);
  features[0] = seed;
  return features;
}

interface LandmarkStoreState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  landmarks: LandmarkFrame | null;
  features: Float32Array | null;
}

const landmarkStore = vi.hoisted(() => {
  const hand = (offsetX: number) => Array.from({ length: 21 }, (_, index) => ({
    x: offsetX + index * 0.001,
    y: 0.2 + index * 0.001,
    z: 0,
  }));
  const initial: LandmarkStoreState = {
    status: "ready",
    error: null,
    landmarks: {
      pose: null,
      leftHand: null,
      rightHand: hand(0.1),
      timestampMs: 0,
    },
    features: new Float32Array(138),
  };
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: LandmarkStoreState) => {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});

vi.mock("@/features/sign-recognition", async () => {
  const { useSyncExternalStore } = await import("react");
  const { ContinuousSignSegmenter } = await import("@/features/sign-recognition/application/continuous-sign-segmenter");
  return {
    ContinuousSignSegmenter,
    LandmarkOverlay: () => null,
    LSB_SEQUENCE_LENGTH: 30,
    useLandmarkDetection: () => useSyncExternalStore(landmarkStore.subscribe, landmarkStore.get),
  };
});

vi.mock("@/features/sign-recognition/infrastructure/onnx-lsb-classifier", () => ({
  OnnxLsbReferenceClassifier: class {
    initialize = classifierMocks.initialize;
    classify = classifierMocks.classify;
    close = classifierMocks.close;
  },
}));

vi.mock("@/features/attention/infrastructure/attention-repository", () => ({
  addAttentionMessage: vi.fn(),
  createAttentionRecord: vi.fn(),
  finishAttentionRecord: vi.fn(),
  listAttentionRecords: vi.fn(),
  reopenAttentionRecord: vi.fn(),
  updateAttentionRecord: vi.fn(),
}));

vi.mock("@/components/ui/Dialog", () => ({
  Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) => open
    ? <div role="dialog">{children}<button type="button" onClick={() => onOpenChange(false)}>Cerrar ajustes</button></div>
    : null,
}));

import { useAttentionStore } from "@/features/attention/application/attention-store";
import { MOCK_HISTORY } from "@/features/procedure-history/mocks/history.mock";
import { CameraPanel } from "./CameraPanel";

function resetStore() {
  useAttentionStore.setState({
    records: MOCK_HISTORY,
    activeRecordId: "AT-2024-0018",
    procedureType: "Registro ciudadano",
    captureStatus: "idle",
    captureText: "",
    captureScore: null,
    captureProgress: 0,
    continuousCapture: false,
    lastCaptureWasCharacter: false,
    draft: "",
    draftError: null,
    notes: "",
    notesError: null,
    notesDirty: false,
    mode: "capture",
    messages: MOCK_HISTORY[0]!.messages,
    isReady: true,
    isLoading: false,
    isSaving: false,
    syncError: null,
  });
}

function resetLandmarks() {
  landmarkStore.set({
    status: "ready",
    error: null,
    landmarks: createLandmarks(0.1),
    features: createFeatures(),
  });
}

function pushFrame(offsetX: number, seed: number) {
  act(() => {
    landmarkStore.set({
      status: "ready",
      error: null,
      landmarks: createLandmarks(offsetX),
      features: createFeatures(seed),
    });
  });
}

function feedSegment() {
  pushFrame(0.1, 0);
  pushFrame(0.13, 1);
  pushFrame(0.16, 2);
  for (let index = 3; index <= 30; index += 1) {
    pushFrame(0.16, index);
  }
}

const camera = {
  status: "active" as const,
  stream: null,
  error: null,
  errorCode: null,
  isSupported: true,
  isActive: true,
  start: vi.fn(async () => undefined),
  stop: vi.fn(),
};

describe("CameraPanel continuous recognition", () => {
  beforeEach(() => {
    resetStore();
    resetLandmarks();
    classifierMocks.initialize.mockClear();
    classifierMocks.classify.mockClear();
    classifierMocks.close.mockClear();
  });

  it("starts continuous recognition and appends a recognized sign to the transcript", async () => {
    const user = userEvent.setup();
    render(<CameraPanel camera={camera} />);

    await waitFor(() => expect(screen.getByText(/Modelo LSB de referencia listo/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Iniciar reconocimiento continuo" }));

    expect(useAttentionStore.getState().continuousCapture).toBe(true);
    expect(useAttentionStore.getState().captureStatus).toBe("capturing");

    feedSegment();

    await waitFor(() => expect(classifierMocks.classify).toHaveBeenCalledOnce());
    await waitFor(() => expect(useAttentionStore.getState().captureText).toBe("HOLA"));

    expect(classifierMocks.classify.mock.calls[0]?.[0]).toHaveLength(30);
    expect(useAttentionStore.getState().captureStatus).toBe("capturing");
    expect(useAttentionStore.getState().continuousCapture).toBe(true);

    await user.click(screen.getByRole("button", { name: "Detener reconocimiento continuo" }));

    expect(useAttentionStore.getState().continuousCapture).toBe(false);
    expect(useAttentionStore.getState().captureStatus).toBe("reviewing");
    expect(useAttentionStore.getState().captureText).toBe("HOLA");
  });

  it("keeps recognition active and reports an uncertain sign", async () => {
    classifierMocks.classify.mockResolvedValueOnce({ label: "YO", classIndex: 43, confidence: 0.49 });
    const user = userEvent.setup();
    render(<CameraPanel camera={camera} />);

    await waitFor(() => expect(screen.getByText(/Modelo LSB de referencia listo/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Iniciar reconocimiento continuo" }));

    feedSegment();

    expect(await screen.findByRole("alert")).toHaveTextContent("umbral de 50%");
    expect(useAttentionStore.getState().captureText).toBe("");
    expect(useAttentionStore.getState().continuousCapture).toBe(true);
    expect(useAttentionStore.getState().captureStatus).toBe("capturing");
  });

  it("accepts the model space label while keeping recognition active", async () => {
    classifierMocks.classify.mockResolvedValueOnce({ label: " ", classIndex: 38, confidence: 0.92 });
    const user = userEvent.setup();
    render(<CameraPanel camera={camera} />);

    await waitFor(() => expect(screen.getByText(/Modelo LSB de referencia listo/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Iniciar reconocimiento continuo" }));
    useAttentionStore.setState({ captureText: "HOLA" });

    feedSegment();

    await waitFor(() => expect(useAttentionStore.getState().captureText).toBe("HOLA "));
    expect(useAttentionStore.getState().continuousCapture).toBe(true);
  });

  it("requires resolving a pending transcript before starting another capture", async () => {
    useAttentionStore.setState({ captureStatus: "reviewing", captureText: "HOLA" });
    render(<CameraPanel camera={camera} />);

    await waitFor(() => expect(screen.getByText(/Modelo LSB de referencia listo/)).toBeInTheDocument());

    const startButton = screen.getByRole("button", { name: "Iniciar reconocimiento continuo" });
    expect(startButton).toBeDisabled();
    expect(startButton).toHaveAttribute("title", "Confirma o descarta la transcripción pendiente");
    expect(screen.getByText(/Confirma o descarta la transcripción antes de iniciar otra captura/)).toBeInTheDocument();
  });
});
