import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/attention/infrastructure/attention-repository", () => ({
  addAttentionMessage: vi.fn(async (_reference: string, message: { sender: string; text: string; source: string; state: string }) => ({
    ...message,
    id: `saved-${Date.now()}`,
    time: "10:25",
  })),
  createAttentionRecord: vi.fn(),
  finishAttentionRecord: vi.fn(),
  listAttentionRecords: vi.fn(),
  reopenAttentionRecord: vi.fn(),
  updateAttentionRecord: vi.fn(),
}));
import { useAttentionStore } from "@/features/attention/application/attention-store";
import { MOCK_HISTORY } from "@/features/procedure-history/mocks/history.mock";
import { ConversationPanel } from "./ConversationPanel";

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

describe("ConversationPanel", () => {
  beforeEach(resetStore);

  it("lets the user review and correct a model candidate before confirming", async () => {
    act(() => {
      useAttentionStore.getState().startContinuousCapture();
      useAttentionStore.getState().appendModelCapture("HOLA", 0.87);
      useAttentionStore.getState().stopContinuousCapture();
    });
    const user = userEvent.setup();
    render(<ConversationPanel onRespond={() => undefined} onUseSigns={() => undefined} />);

    const proposal = await screen.findByRole("textbox", { name: "Editar propuesta" });
    await user.clear(proposal);
    await user.type(proposal, "Necesito orientación para mi trámite.");
    await user.click(screen.getByRole("button", { name: "Confirmar mensaje" }));

    expect(await screen.findByRole("button", { name: /Necesito orientación para mi trámite/ })).toBeInTheDocument();
    expect(useAttentionStore.getState().captureStatus).toBe("confirmed");
  });

  it("lets the user discard a model candidate", async () => {
    act(() => {
      useAttentionStore.getState().startContinuousCapture();
      useAttentionStore.getState().appendModelCapture("YO", 0.9);
      useAttentionStore.getState().stopContinuousCapture();
    });
    const user = userEvent.setup();
    render(<ConversationPanel onRespond={() => undefined} onUseSigns={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Descartar" }));
    expect(useAttentionStore.getState().captureStatus).toBe("idle");
  });

  it("shows an experimental model result as an editable candidate with an uncalibrated score", async () => {
    act(() => {
      useAttentionStore.getState().startContinuousCapture();
      useAttentionStore.getState().appendModelCapture("HOLA", 0.87);
      useAttentionStore.getState().stopContinuousCapture();
    });
    render(<ConversationPanel onRespond={() => undefined} onUseSigns={() => undefined} />);

    expect(screen.getByRole("textbox", { name: "Editar propuesta" })).toHaveValue("HOLA");
    expect(screen.getByText(/puntuación softmax 87.0% \(no calibrada\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("accumulates signs in an editable live transcript and stops for review", async () => {
    act(() => {
      useAttentionStore.getState().startContinuousCapture();
      useAttentionStore.getState().appendModelCapture("HOLA", 0.87);
      useAttentionStore.getState().appendModelCapture("M", 0.81);
      useAttentionStore.getState().appendModelCapture("U", 0.79);
    });
    const user = userEvent.setup();
    render(<ConversationPanel onRespond={() => undefined} onUseSigns={() => undefined} />);

    expect(screen.getByRole("textbox", { name: "Editar transcripción en vivo" })).toHaveValue("HOLA MU");

    await user.click(screen.getByRole("button", { name: "Detener y revisar" }));

    expect(useAttentionStore.getState().captureStatus).toBe("reviewing");
    expect(screen.getByRole("textbox", { name: "Editar propuesta" })).toHaveValue("HOLA MU");
  });
});
