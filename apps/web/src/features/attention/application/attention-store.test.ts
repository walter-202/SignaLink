import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAttentionStore } from "./attention-store";
import { procedureRepository } from "@/lib/supabase/procedure-repository";
import { MOCK_HISTORY } from "@/features/procedure-history/mocks/history.mock";

describe("useAttentionStore - Supabase Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
      messages: [],
      isLoadingHistory: false,
    });
  });

  it("loadHistory sincroniza los registros obtenidos de procedureRepository", async () => {
    const fakeRecord = {
      id: "11111111-2222-3333-4444-555555555555",
      procedureType: "Certificado de nacimiento",
      startedAt: new Date().toISOString(),
      status: "completed" as const,
      durationMinutes: 15,
      notes: "Atención completada",
      messages: [],
    };

    vi.spyOn(procedureRepository, "getHistory").mockResolvedValue([fakeRecord, ...MOCK_HISTORY]);

    await useAttentionStore.getState().loadHistory();

    const records = useAttentionStore.getState().records;
    expect(records.length).toBe(MOCK_HISTORY.length + 1);
    expect(records[0]?.id).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("startNewAttention genera un UUID y dispara la creación en Supabase", () => {
    const createSpy = vi.spyOn(procedureRepository, "createProcedure").mockResolvedValue("uuid-creado");

    useAttentionStore.getState().startNewAttention();

    const state = useAttentionStore.getState();
    expect(state.records.length).toBe(MOCK_HISTORY.length + 1);
    expect(state.activeRecordId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(state.procedureType).toBe("Registro ciudadano");
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: state.activeRecordId,
        procedureType: "Registro ciudadano",
        status: "active",
      }),
    );
  });

  it("sendReply persiste el mensaje en Supabase", () => {
    const appendSpy = vi.spyOn(procedureRepository, "appendMessage").mockResolvedValue();
    useAttentionStore.getState().startNewAttention();

    const activeId = useAttentionStore.getState().activeRecordId;
    useAttentionStore.setState({ draft: "Buenos días, ¿en qué podemos ayudarle?" });

    const sent = useAttentionStore.getState().sendReply("typed");
    expect(sent).toBe(true);

    const messages = useAttentionStore.getState().messages;
    expect(messages.length).toBe(1);
    expect(messages[0]?.text).toBe("Buenos días, ¿en qué podemos ayudarle?");
    expect(appendSpy).toHaveBeenCalledWith(activeId, expect.objectContaining({ text: "Buenos días, ¿en qué podemos ayudarle?" }));
  });

  it("finishAttention marca el trámite como completado y actualiza Supabase", () => {
    const completeSpy = vi.spyOn(procedureRepository, "completeProcedure").mockResolvedValue();
    useAttentionStore.getState().startNewAttention();

    const activeId = useAttentionStore.getState().activeRecordId;
    useAttentionStore.setState({ notes: "Observación de cierre válida" });

    useAttentionStore.getState().finishAttention();

    const activeRecord = useAttentionStore.getState().records.find((r) => r.id === activeId);
    expect(activeRecord?.status).toBe("completed");
    expect(completeSpy).toHaveBeenCalledWith(activeId, "Observación de cierre válida", expect.any(Number));
  });

  it("reopenAttention reabre el trámite y notifica a Supabase", () => {
    const reopenSpy = vi.spyOn(procedureRepository, "reopenProcedure").mockResolvedValue();
    const testId = "11111111-2222-3333-4444-555555555555";
    useAttentionStore.setState({
      records: [
        {
          id: testId,
          procedureType: "Registro ciudadano",
          startedAt: new Date().toISOString(),
          status: "completed",
          durationMinutes: 10,
          messages: [],
          notes: "",
        },
      ],
      activeRecordId: testId,
    });

    useAttentionStore.getState().reopenAttention(testId);

    const record = useAttentionStore.getState().records.find((r) => r.id === testId);
    expect(record?.status).toBe("active");
    expect(reopenSpy).toHaveBeenCalledWith(testId);
  });
});
