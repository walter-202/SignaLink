"use client";

import { create } from "zustand";
import { MOCK_HISTORY, MOCK_HISTORY_ANCHOR } from "@/features/procedure-history/mocks/history.mock";
import type { ConversationMessage, HistoryRecord } from "@/features/procedure-history/domain/types";
import { procedureRepository } from "@/lib/supabase/procedure-repository";
import { recognizeMockSign } from "./mock-recognition-service";
import { procedureNotesSchema, replyTextSchema } from "./validation";

export type CaptureStatus = "idle" | "capturing" | "processing" | "reviewing" | "confirmed" | "error";
export type ConversationMode = "capture" | "reply";

interface AttentionState {
  records: HistoryRecord[];
  activeRecordId: string;
  procedureType: string;
  captureStatus: CaptureStatus;
  captureText: string;
  captureError: string | null;
  failNextRecognition: boolean;
  draft: string;
  draftError: string | null;
  notes: string;
  notesError: string | null;
  mode: ConversationMode;
  messages: ConversationMessage[];
  isLoadingHistory: boolean;
  loadHistory: () => Promise<void>;
  startCapture: () => Promise<void>;
  cancelCapture: () => void;
  confirmCapture: () => void;
  setCaptureText: (value: string) => void;
  retryCapture: () => Promise<void>;
  clearCapture: () => void;
  setFailNextRecognition: (enabled: boolean) => void;
  setDraft: (value: string) => void;
  sendReply: (source?: ConversationMessage["source"]) => boolean;
  setNotes: (value: string) => void;
  setMode: (mode: ConversationMode) => void;
  setProcedureType: (procedureType: string) => void;
  finishAttention: () => void;
  startNewAttention: () => void;
  reopenAttention: (recordId: string) => void;
}

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const initialRecord = MOCK_HISTORY.find((record) => record.status === "active") ?? MOCK_HISTORY[0];
let captureAttempt = 0;

function formatTime(date = new Date()): string {
  return new Intl.DateTimeFormat("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function replaceRecord(
  records: HistoryRecord[],
  recordId: string,
  transform: (record: HistoryRecord) => HistoryRecord,
): HistoryRecord[] {
  return records.map((record) => record.id === recordId ? transform(record) : record);
}

function createMessage(
  sender: ConversationMessage["sender"],
  text: string,
  source: ConversationMessage["source"],
): ConversationMessage {
  return {
    id: generateUuid(),
    sender,
    text,
    time: formatTime(),
    state: sender === "citizen" ? "confirmed" : "sent",
    source,
  };
}

function ensureProcedurePersisted(
  state: AttentionState,
  set: (fn: (current: AttentionState) => Partial<AttentionState>) => void,
): string {
  const currentId = state.activeRecordId;
  if (isUuid(currentId)) {
    return currentId;
  }

  const newUuid = generateUuid();
  const currentRecord = state.records.find((r) => r.id === currentId);
  const procedureType = currentRecord?.procedureType ?? state.procedureType ?? "Registro ciudadano";
  const notes = currentRecord?.notes ?? state.notes ?? "";

  set((prev) => ({
    activeRecordId: newUuid,
    records: prev.records.map((r) => r.id === currentId ? { ...r, id: newUuid } : r),
  }));

  void procedureRepository.createProcedure({
    id: newUuid,
    procedureType,
    status: "active",
    notes,
  });

  return newUuid;
}

export const useAttentionStore = create<AttentionState>((set, get) => ({
  records: MOCK_HISTORY,
  activeRecordId: initialRecord.id,
  procedureType: initialRecord.procedureType,
  captureStatus: "idle",
  captureText: "",
  captureError: null,
  failNextRecognition: false,
  draft: "",
  draftError: null,
  notes: initialRecord.notes,
  notesError: null,
  mode: "capture",
  messages: initialRecord.messages,
  isLoadingHistory: false,

  loadHistory: async () => {
    if (get().isLoadingHistory) return;
    set({ isLoadingHistory: true });
    try {
      const history = await procedureRepository.getHistory();
      set((current) => {
        const activeRecord = current.records.find((r) => r.id === current.activeRecordId);
        const historyIds = new Set(history.map((r) => r.id));
        let mergedRecords = history;
        if (activeRecord && !historyIds.has(activeRecord.id)) {
          mergedRecords = [activeRecord, ...history];
        }

        const activeInHistory = history.find((r) => r.status === "active");
        let activeRecordId = current.activeRecordId;
        let messages = current.messages;
        let notes = current.notes;
        let procedureType = current.procedureType;

        if (!isUuid(activeRecordId) && activeInHistory) {
          activeRecordId = activeInHistory.id;
          messages = activeInHistory.messages;
          notes = activeInHistory.notes;
          procedureType = activeInHistory.procedureType;
        }

        return {
          records: mergedRecords,
          activeRecordId,
          messages,
          notes,
          procedureType,
          isLoadingHistory: false,
        };
      });
    } catch (err) {
      console.warn("No se pudo cargar el historial desde Supabase:", err);
      set({ isLoadingHistory: false });
    }
  },

  startCapture: async () => {
    const activeRecord = get().records.find((record) => record.id === get().activeRecordId);
    if (activeRecord?.status !== "active") return;
    const attempt = ++captureAttempt;
    const shouldFail = get().failNextRecognition;
    set({
      captureStatus: "capturing",
      captureError: null,
      captureText: "",
      failNextRecognition: false,
      mode: "capture",
    });
    await Promise.resolve();
    if (attempt !== captureAttempt) return;
    set({ captureStatus: "processing" });
    try {
      const suggestion = await recognizeMockSign({
        simulateError: shouldFail,
        onProcessing: () => {
          if (attempt === captureAttempt) set({ captureStatus: "processing" });
        },
      });
      if (attempt !== captureAttempt) return;
      set({ captureStatus: "reviewing", captureText: suggestion });
    } catch (error) {
      if (attempt !== captureAttempt) return;
      set({
        captureStatus: "error",
        captureError: error instanceof Error ? error.message : "Ocurrió un error de demostración.",
      });
    }
  },

  cancelCapture: () => {
    captureAttempt += 1;
    set({ captureStatus: "idle", captureText: "", captureError: null });
  },

  confirmCapture: () => {
    const state = get();
    if (state.captureStatus !== "reviewing" || !state.captureText.trim()) return;
    const message = createMessage("citizen", state.captureText.trim(), "reviewed-sign");
    const messages = [...state.messages, message];
    const procedureId = ensureProcedurePersisted(state, set);

    set((current) => ({
      messages,
      captureStatus: "confirmed",
      captureError: null,
      records: replaceRecord(current.records, procedureId, (record) => ({
        ...record,
        messages,
      })),
    }));

    void procedureRepository.appendMessage(procedureId, message);
  },

  setCaptureText: (captureText) => set({ captureText }),

  retryCapture: async () => {
    await get().startCapture();
  },

  clearCapture: () => set({ captureStatus: "idle", captureText: "", captureError: null }),
  setFailNextRecognition: (enabled) => set({ failNextRecognition: enabled }),
  setDraft: (draft) => set({ draft, draftError: null }),

  sendReply: (source = "typed") => {
    const state = get();
    const activeRecord = state.records.find((record) => record.id === state.activeRecordId);
    if (activeRecord?.status !== "active") return false;
    const result = replyTextSchema.safeParse(state.draft);
    if (!result.success) {
      set({ draftError: result.error.issues[0]?.message ?? "Revisa el texto antes de continuar." });
      return false;
    }
    const message = createMessage("staff", result.data, source);
    const messages = [...state.messages, message];
    const procedureId = ensureProcedurePersisted(state, set);

    set((current) => ({
      messages,
      draft: "",
      draftError: null,
      records: replaceRecord(current.records, procedureId, (record) => ({
        ...record,
        messages,
      })),
      mode: "capture",
    }));

    void procedureRepository.appendMessage(procedureId, message);
    return true;
  },

  setNotes: (notes) => {
    const result = procedureNotesSchema.safeParse(notes);
    if (!result.success) {
      set({ notes, notesError: result.error.issues[0]?.message ?? "Revisa las observaciones." });
      return;
    }
    const currentId = get().activeRecordId;
    set((state) => ({
      notes,
      notesError: null,
      records: replaceRecord(state.records, currentId, (record) => ({ ...record, notes })),
    }));
    if (isUuid(currentId)) {
      void procedureRepository.updateProcedureNotes(currentId, notes);
    }
  },

  setMode: (mode) => set({ mode }),

  setProcedureType: (procedureType) => {
    const currentId = get().activeRecordId;
    set((state) => ({
      procedureType,
      records: replaceRecord(state.records, currentId, (record) => ({
        ...record,
        procedureType,
      })),
    }));
    if (isUuid(currentId)) {
      void procedureRepository.updateProcedureType(currentId, procedureType);
    }
  },

  finishAttention: () => {
    captureAttempt += 1;
    const state = get();
    const procedureId = ensureProcedurePersisted(state, set);
    const notes = state.notes;
    const currentRecord = state.records.find((r) => r.id === procedureId);
    const durationMinutes = Math.max(currentRecord?.durationMinutes ?? 0, 12);

    set((current) => ({
      records: replaceRecord(current.records, procedureId, (record) => ({
        ...record,
        status: "completed",
        durationMinutes,
        notes,
      })),
      captureStatus: "idle",
      captureText: "",
      captureError: null,
    }));

    void procedureRepository.completeProcedure(procedureId, notes, durationMinutes);
  },

  startNewAttention: () => {
    const newId = generateUuid();
    const record: HistoryRecord = {
      id: newId,
      procedureType: "Registro ciudadano",
      startedAt: new Date().toISOString(),
      status: "active",
      durationMinutes: 0,
      messages: [],
      notes: "",
    };
    captureAttempt += 1;
    set((current) => ({
      records: [record, ...current.records.filter((r) => r.id !== newId)],
      activeRecordId: record.id,
      procedureType: record.procedureType,
      captureStatus: "idle",
      captureText: "",
      captureError: null,
      draft: "",
      draftError: null,
      notes: "",
      notesError: null,
      messages: [],
      mode: "capture",
    }));

    void procedureRepository.createProcedure({
      id: newId,
      procedureType: record.procedureType,
      status: "active",
    });
  },

  reopenAttention: (recordId) => {
    const record = get().records.find((item) => item.id === recordId);
    if (!record || record.status === "cancelled") return;
    captureAttempt += 1;
    set((state) => ({
      records: replaceRecord(state.records, recordId, (item) => ({ ...item, status: "active" })),
      activeRecordId: recordId,
      procedureType: record.procedureType,
      messages: record.messages,
      notes: record.notes,
      captureStatus: "idle",
      captureText: "",
      captureError: null,
    }));
    if (isUuid(recordId)) {
      void procedureRepository.reopenProcedure(recordId);
    }
  },
}));

export function getActiveRecord(records: HistoryRecord[], recordId: string): HistoryRecord {
  return records.find((record) => record.id === recordId) ?? initialRecord;
}
