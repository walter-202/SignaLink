"use client";

import { create } from "zustand";
import { MOCK_HISTORY, MOCK_HISTORY_ANCHOR } from "@/features/procedure-history/mocks/history.mock";
import type { ConversationMessage, HistoryRecord } from "@/features/procedure-history/domain/types";
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
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender,
    text,
    time: formatTime(),
    state: sender === "citizen" ? "confirmed" : "sent",
    source,
  };
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
    set((current) => ({
      messages,
      captureStatus: "confirmed",
      captureError: null,
      records: replaceRecord(current.records, current.activeRecordId, (record) => ({
        ...record,
        messages,
      })),
    }));
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
    const messages = [...state.messages, createMessage("staff", result.data, source)];
    set((current) => ({
      messages,
      draft: "",
      draftError: null,
      records: replaceRecord(current.records, current.activeRecordId, (record) => ({
        ...record,
        messages,
      })),
      mode: "capture",
    }));
    return true;
  },

  setNotes: (notes) => {
    const result = procedureNotesSchema.safeParse(notes);
    if (!result.success) {
      set({ notes, notesError: result.error.issues[0]?.message ?? "Revisa las observaciones." });
      return;
    }
    set((state) => ({
      notes,
      notesError: null,
      records: replaceRecord(state.records, state.activeRecordId, (record) => ({ ...record, notes })),
    }));
  },

  setMode: (mode) => set({ mode }),

  setProcedureType: (procedureType) => set((state) => ({
    procedureType,
    records: replaceRecord(state.records, state.activeRecordId, (record) => ({
      ...record,
      procedureType,
    })),
  })),

  finishAttention: () => {
    captureAttempt += 1;
    set((state) => ({
      records: replaceRecord(state.records, state.activeRecordId, (record) => ({
        ...record,
        status: "completed",
        durationMinutes: Math.max(record.durationMinutes, 12),
        notes: state.notes,
      })),
      captureStatus: "idle",
      captureText: "",
      captureError: null,
    }));
  },

  startNewAttention: () => {
    const state = get();
    const nextNumber = state.records.reduce((max, record) => {
      const match = record.id.match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0) + 1;
    const record: HistoryRecord = {
      id: `AT-DEMO-${String(nextNumber).padStart(4, "0")}`,
      procedureType: "Registro ciudadano",
      startedAt: new Date(MOCK_HISTORY_ANCHOR.getTime() - 60_000).toISOString(),
      status: "active",
      durationMinutes: 0,
      messages: [],
      notes: "",
    };
    captureAttempt += 1;
    set((current) => ({
      records: [record, ...current.records],
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
  },
}));

export function getActiveRecord(records: HistoryRecord[], recordId: string): HistoryRecord {
  return records.find((record) => record.id === recordId) ?? initialRecord;
}
