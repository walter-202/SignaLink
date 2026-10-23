import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const classifierMocks = vi.hoisted(() => ({
  initialize: vi.fn(async () => undefined),
  classify: vi.fn(async (sequence: readonly Float32Array[]) => ({
    label: "HOLA",
    classIndex: 39,
    confidence: sequence.length === 30 ? 0.91 : 0.49,
  })),
  close: vi.fn(),
}));

vi.mock("@/features/sign-recognition", () => ({
  LandmarkOverlay: () => null,
  LSB_SEQUENCE_LENGTH: 30,
  useLandmarkDetection: () => ({
    status: "ready",
    error: null,
    landmarks: { pose: null, leftHand: [{ x: 0.2, y: 0.2, z: 0 }], rightHand: null, timestampMs: 1 },
    features: new Float32Array(138),
  }),
}));

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

vi.mock("@/components/ui/Select", () => ({
  Select: ({ id, label, value, options, onValueChange }: {
    id: string;
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onValueChange: (value: string) => void;
  }) => (
    <label htmlFor={id}>{label}<select id={id} value={value} onChange={(event) => onValueChange(event.currentTarget.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
  ),
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
    captureError: null,
    failNextRecognition: false,
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

describe("CameraPanel model capture", () => {
  beforeEach(() => {
    resetStore();
    classifierMocks.initialize.mockClear();
    classifierMocks.classify.mockClear();
    classifierMocks.close.mockClear();
  });

  it("loads the LSB model, collects 30 frames and opens an editable candidate", async () => {
    const user = userEvent.setup();
    render(<CameraPanel camera={camera} />);

    await user.click(screen.getByRole("button", { name: "Ajustes de captura" }));
    await user.selectOptions(screen.getByLabelText("Modelo de reconocimiento"), "lsb-reference-v4");
    await waitFor(() => expect(screen.getByText(/Modelo cargado y verificado localmente/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Cerrar ajustes" }));

    await user.click(screen.getByRole("button", { name: "Capturar una seña con la cámara" }));
    await waitFor(() => expect(useAttentionStore.getState().captureStatus).toBe("reviewing"));

    expect(classifierMocks.initialize).toHaveBeenCalledOnce();
    expect(classifierMocks.classify).toHaveBeenCalledOnce();
    expect(classifierMocks.classify.mock.calls[0]?.[0]).toHaveLength(30);
    expect(useAttentionStore.getState().captureText).toBe("HOLA");
    expect(useAttentionStore.getState().captureScore).toBe(0.91);
  });

  it("abstains instead of opening a proposal when the score is below 50%", async () => {
    classifierMocks.classify.mockResolvedValueOnce({ label: "YO", classIndex: 43, confidence: 0.49 });
    const user = userEvent.setup();
    render(<CameraPanel camera={camera} />);

    await user.click(screen.getByRole("button", { name: "Ajustes de captura" }));
    await user.selectOptions(screen.getByLabelText("Modelo de reconocimiento"), "lsb-reference-v4");
    await waitFor(() => expect(screen.getByText(/Modelo cargado y verificado localmente/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Cerrar ajustes" }));
    await user.click(screen.getByRole("button", { name: "Capturar una seña con la cámara" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("umbral de 50%");
    expect(useAttentionStore.getState().captureStatus).toBe("idle");
    expect(useAttentionStore.getState().captureText).toBe("");
  });
});
