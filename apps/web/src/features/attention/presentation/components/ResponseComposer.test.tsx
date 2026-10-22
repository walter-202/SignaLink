import { act, render, screen, waitFor } from "@testing-library/react";
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
import {
  SpeechRecognitionProvider,
  type SpeechRecognitionService,
  type SpeechRecognitionSession,
  type SpeechRecognitionSessionOptions,
} from "@/features/communication";
import { useAttentionStore } from "@/features/attention/application/attention-store";
import { MOCK_HISTORY } from "@/features/procedure-history/mocks/history.mock";
import { ResponseComposer } from "./ResponseComposer";

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
    notesDirty: false,
    mode: "capture",
    messages: MOCK_HISTORY[0]!.messages,
    isReady: true,
    isLoading: false,
    isSaving: false,
    syncError: null,
  });
}

function createFakeSpeechService(supported = true) {
  let options: SpeechRecognitionSessionOptions | null = null;
  const session: SpeechRecognitionSession = {
    start: vi.fn(() => options?.onStart()),
    stop: vi.fn(() => options?.onEnd()),
    abort: vi.fn(() => options?.onEnd()),
  };
  const service: SpeechRecognitionService = {
    isSupported: () => supported,
    createSession: vi.fn((nextOptions) => {
      options = nextOptions;
      return supported ? session : null;
    }),
  };
  return { service, session, getOptions: () => options };
}

describe("ResponseComposer speech service", () => {
  beforeEach(resetStore);

  it("adds recognized speech to the draft and preserves dictation as the message source", async () => {
    const user = userEvent.setup();
    const { service, session, getOptions } = createFakeSpeechService();
    useAttentionStore.setState({ draft: "Buenos días." });
    render(
      <SpeechRecognitionProvider service={service}>
        <ResponseComposer />
      </SpeechRecognitionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Iniciar dictado" }));
    expect(session.start).toHaveBeenCalledOnce();
    act(() => getOptions()?.onResult({
      finalTranscript: "Su trámite está",
      interimTranscript: "listo",
    }));

    const draft = screen.getByRole("textbox", { name: "Respuesta para la conversación" });
    expect(draft).toHaveValue("Buenos días. Su trámite está");
    expect(draft).toBeDisabled();
    act(() => getOptions()?.onResult({
      finalTranscript: "listo.",
      interimTranscript: "",
    }));
    expect(draft).toHaveValue("Buenos días. Su trámite está listo.");
    await user.click(screen.getByRole("button", { name: "Detener dictado" }));
    await waitFor(() => expect(draft).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Enviar respuesta" }));

    await waitFor(() => expect(useAttentionStore.getState().messages.at(-1)?.text).toBe("Buenos días. Su trámite está listo."));
    const sentMessage = useAttentionStore.getState().messages.at(-1);
    expect(sentMessage?.text).toBe("Buenos días. Su trámite está listo.");
    expect(sentMessage?.source).toBe("dictation");
    expect(service.createSession).toHaveBeenCalledOnce();
  });

  it("keeps manual typing available when the browser does not support dictation", () => {
    const { service } = createFakeSpeechService(false);
    render(
      <SpeechRecognitionProvider service={service}>
        <ResponseComposer />
      </SpeechRecognitionProvider>,
    );

    expect(screen.getByRole("button", { name: "Iniciar dictado" })).toBeDisabled();
    expect(screen.getByText(/no está disponible en este navegador/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Respuesta para la conversación" })).toBeEnabled();
  });

  it("explains microphone denial and returns control to manual typing", async () => {
    const user = userEvent.setup();
    const { service, getOptions } = createFakeSpeechService();
    render(
      <SpeechRecognitionProvider service={service}>
        <ResponseComposer />
      </SpeechRecognitionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Iniciar dictado" }));
    act(() => getOptions()?.onError("not-allowed"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se autorizó el micrófono/i);
    expect(screen.getByRole("textbox", { name: "Respuesta para la conversación" })).toBeEnabled();
  });
});
