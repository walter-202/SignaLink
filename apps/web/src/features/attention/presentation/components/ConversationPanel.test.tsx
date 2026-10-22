import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
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
    captureError: null,
    failNextRecognition: false,
    draft: "",
    draftError: null,
    notes: "",
    notesError: null,
    mode: "capture",
    messages: MOCK_HISTORY[0]!.messages,
  });
}

describe("ConversationPanel", () => {
  beforeEach(resetStore);

  it("lets the user review and correct a simulated interpretation before confirming", async () => {
    const user = userEvent.setup();
    render(<ConversationPanel onRespond={() => undefined} onUseSigns={() => void useAttentionStore.getState().startCapture()} />);

    await user.click(screen.getByRole("button", { name: /Usar señas/ }));
    const proposal = await screen.findByRole("textbox", { name: "Editar propuesta" });
    await user.clear(proposal);
    await user.type(proposal, "Necesito orientación para mi trámite.");
    await user.click(screen.getByRole("button", { name: "Confirmar mensaje" }));

    expect(await screen.findByRole("button", { name: /Necesito orientación para mi trámite/ })).toBeInTheDocument();
    expect(useAttentionStore.getState().captureStatus).toBe("confirmed");
  });

  it("shows a simulated error and lets the user retry successfully", async () => {
    const user = userEvent.setup();
    act(() => useAttentionStore.getState().setFailNextRecognition(true));
    render(<ConversationPanel onRespond={() => undefined} onUseSigns={() => void useAttentionStore.getState().startCapture()} />);

    await user.click(screen.getByRole("button", { name: /Usar señas/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo preparar una interpretación de demostración.");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(useAttentionStore.getState().captureStatus).toBe("reviewing"));
    expect(screen.getByRole("textbox", { name: "Editar propuesta" })).toBeInTheDocument();
  });
});
