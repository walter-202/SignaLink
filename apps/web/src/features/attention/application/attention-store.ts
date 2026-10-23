"use client";

import { create } from "zustand";
import type { ConversationMessage, HistoryRecord } from "@/features/procedure-history/domain/types";
import {
  addAttentionMessage,
  createAttentionRecord,
  finishAttentionRecord,
  listAttentionRecords,
  reopenAttentionRecord,
  updateAttentionRecord,
} from "../infrastructure/attention-repository";
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
  captureScore: number | null;
  captureProgress: number;
  captureError: string | null;
  failNextRecognition: boolean;
  draft: string;
  draftError: string | null;
  notes: string;
  notesError: string | null;
  notesDirty: boolean;
  mode: ConversationMode;
  messages: ConversationMessage[];
  isReady: boolean;
  isLoading: boolean;
  isSaving: boolean;
  syncError: string | null;
  loadRecords: () => Promise<void>;
  clearSyncError: () => void;
  startCapture: () => Promise<void>;
  beginModelCapture: () => void;
  setCaptureProgress: (progress: number) => void;
  setCaptureProcessing: () => void;
  completeModelCapture: (captureText: string, score: number) => void;
  cancelCapture: () => void;
  confirmCapture: () => Promise<void>;
  setCaptureText: (value: string) => void;
  retryCapture: () => Promise<void>;
  clearCapture: () => void;
  setFailNextRecognition: (enabled: boolean) => void;
  setDraft: (value: string) => void;
  sendReply: (source?: ConversationMessage["source"]) => Promise<boolean>;
  setNotes: (value: string) => void;
  saveNotes: () => Promise<void>;
  setMode: (mode: ConversationMode) => void;
  setProcedureType: (procedureType: string) => Promise<void>;
  finishAttention: () => Promise<void>;
  startNewAttention: () => Promise<void>;
  reopenAttention: (recordId: string) => Promise<void>;
}

let captureAttempt = 0;

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
): Pick<ConversationMessage, "sender" | "text" | "source" | "state"> {
  return {
    sender,
    text,
    source,
    state: sender === "citizen" ? "confirmed" : "sent",
  };
}

function getRecord(state: AttentionState): HistoryRecord | undefined {
  return state.records.find((record) => record.id === state.activeRecordId);
}

export const useAttentionStore = create<AttentionState>((set, get) => ({
  records: [],
  activeRecordId: "",
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
  messages: [],
  isReady: false,
  isLoading: false,
  isSaving: false,
  syncError: null,

  loadRecords: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, syncError: null });
    try {
      const records = await listAttentionRecords();
      const activeRecord = records.find((record) => record.status === "active") ?? records[0];
      set({
        records,
        activeRecordId: activeRecord?.id ?? "",
        procedureType: activeRecord?.procedureType ?? "Registro ciudadano",
        notes: activeRecord?.notes ?? "",
        notesDirty: false,
        messages: activeRecord?.messages ?? [],
        isReady: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        isReady: true,
        isLoading: false,
        syncError: error instanceof Error ? error.message : "No se pudieron cargar las atenciones.",
      });
    }
  },

  clearSyncError: () => set({ syncError: null }),

  startCapture: async () => {
    const activeRecord = getRecord(get());
    if (activeRecord?.status !== "active") return;
    const attempt = ++captureAttempt;
    const shouldFail = get().failNextRecognition;
    set({
      captureStatus: "capturing",
      captureError: null,
      captureText: "",
      captureScore: null,
      captureProgress: 0,
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

  beginModelCapture: () => {
    if (getRecord(get())?.status !== "active") return;
    captureAttempt += 1;
    set({
      captureStatus: "capturing",
      captureText: "",
      captureScore: null,
      captureProgress: 0,
      captureError: null,
      mode: "capture",
    });
  },

  setCaptureProgress: (captureProgress) => {
    set({ captureProgress: Math.min(30, Math.max(0, Math.floor(captureProgress))) });
  },

  setCaptureProcessing: () => {
    if (get().captureStatus === "capturing") set({ captureStatus: "processing" });
  },

  completeModelCapture: (captureText, captureScore) => {
    if (get().captureStatus !== "processing") return;
    set({
      captureStatus: "reviewing",
      captureText,
      captureScore,
      captureError: null,
    });
  },

  cancelCapture: () => {
    captureAttempt += 1;
    set({ captureStatus: "idle", captureText: "", captureScore: null, captureProgress: 0, captureError: null });
  },

  confirmCapture: async () => {
    const state = get();
    const record = getRecord(state);
    if (state.captureStatus !== "reviewing" || !state.captureText.trim() || !record || state.isSaving) return;
    set({ isSaving: true, syncError: null });
    try {
      const message = await addAttentionMessage(
        record.id,
        createMessage("citizen", state.captureText.trim(), "reviewed-sign"),
      );
      const messages = [...get().messages, message];
      set((current) => ({
        messages,
        captureStatus: "confirmed",
        captureError: null,
        syncError: null,
        records: replaceRecord(current.records, record.id, (currentRecord) => ({ ...currentRecord, messages })),
      }));
    } catch (error) {
      set({ syncError: error instanceof Error ? error.message : "No se pudo guardar el mensaje.", captureError: "No se guardó el mensaje. Puedes volver a intentarlo." });
    } finally {
      set({ isSaving: false });
    }
  },

  setCaptureText: (captureText) => set({ captureText }),

  retryCapture: async () => {
    await get().startCapture();
  },

  clearCapture: () => set({ captureStatus: "idle", captureText: "", captureScore: null, captureProgress: 0, captureError: null }),
  setFailNextRecognition: (enabled) => set({ failNextRecognition: enabled }),
  setDraft: (draft) => set({ draft, draftError: null }),

  sendReply: async (source = "typed") => {
    const state = get();
    const activeRecord = getRecord(state);
    if (activeRecord?.status !== "active" || state.isSaving) return false;
    const result = replyTextSchema.safeParse(state.draft);
    if (!result.success) {
      set({ draftError: result.error.issues[0]?.message ?? "Revisa el texto antes de continuar." });
      return false;
    }

    set({ isSaving: true, syncError: null });
    try {
      const message = await addAttentionMessage(
        activeRecord.id,
        createMessage("staff", result.data, source),
      );
      const messages = [...get().messages, message];
      set((current) => ({
        messages,
        draft: "",
        draftError: null,
        syncError: null,
        records: replaceRecord(current.records, activeRecord.id, (record) => ({ ...record, messages })),
        mode: "capture",
      }));
      return true;
    } catch (error) {
      set({ syncError: error instanceof Error ? error.message : "No se pudo guardar la respuesta." });
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  setNotes: (notes) => {
    const result = procedureNotesSchema.safeParse(notes);
    if (!result.success) {
      set({ notes, notesError: result.error.issues[0]?.message ?? "Revisa las observaciones." });
      return;
    }
    const activeRecord = getRecord(get());
    set((state) => ({
      notes,
      notesError: null,
      notesDirty: true,
      records: activeRecord
        ? replaceRecord(state.records, activeRecord.id, (record) => ({ ...record, notes }))
        : state.records,
    }));
  },

  saveNotes: async () => {
    const state = get();
    const record = getRecord(state);
    if (!record || !state.notesDirty || state.isSaving) return;
    set({ isSaving: true, syncError: null });
    try {
      await updateAttentionRecord(record.id, { notes: state.notes });
      set({ notesDirty: false, notesError: null, syncError: null });
    } catch (error) {
      set({ syncError: error instanceof Error ? error.message : "No se pudieron guardar las observaciones." });
    } finally {
      set({ isSaving: false });
    }
  },

  setMode: (mode) => set({ mode }),

  setProcedureType: async (procedureType) => {
    const state = get();
    const record = getRecord(state);
    if (!record || record.status !== "active" || state.isSaving) return;
    const previousType = state.procedureType;
    set({ procedureType, isSaving: true, syncError: null });
    set((current) => ({
      records: replaceRecord(current.records, record.id, (item) => ({ ...item, procedureType })),
    }));
    try {
      await updateAttentionRecord(record.id, { procedureType });
    } catch (error) {
      set((current) => ({
        procedureType: current.activeRecordId === record.id ? previousType : current.procedureType,
        records: replaceRecord(current.records, record.id, (item) => ({ ...item, procedureType: previousType })),
        syncError: error instanceof Error ? error.message : "No se pudo guardar el tipo de trámite.",
      }));
    } finally {
      set({ isSaving: false });
    }
  },

  finishAttention: async () => {
    const state = get();
    const record = getRecord(state);
    if (!record || record.status !== "active" || state.isSaving) return;
    captureAttempt += 1;
    set({ isSaving: true, syncError: null });
    try {
      const { durationMinutes } = await finishAttentionRecord(record.id);
      set((current) => ({
        records: replaceRecord(current.records, record.id, (item) => ({ ...item, status: "completed", durationMinutes })),
        captureStatus: "idle",
        captureText: "",
        captureScore: null,
        captureProgress: 0,
        captureError: null,
        syncError: null,
      }));
    } catch (error) {
      set({ syncError: error instanceof Error ? error.message : "No se pudo finalizar la atención." });
    } finally {
      set({ isSaving: false });
    }
  },

  startNewAttention: async () => {
    if (get().isSaving) return;
    set({ isSaving: true, syncError: null });
    try {
      const record = await createAttentionRecord("Registro ciudadano");
      captureAttempt += 1;
      set((current) => ({
        records: [record, ...current.records],
        activeRecordId: record.id,
        procedureType: record.procedureType,
        captureStatus: "idle",
        captureText: "",
        captureScore: null,
        captureProgress: 0,
        captureError: null,
        draft: "",
        draftError: null,
        notes: "",
        notesError: null,
        notesDirty: false,
        messages: [],
        mode: "capture",
        syncError: null,
      }));
    } catch (error) {
      set({ syncError: error instanceof Error ? error.message : "No se pudo iniciar una atención." });
    } finally {
      set({ isSaving: false });
    }
  },

  reopenAttention: async (recordId) => {
    const record = get().records.find((item) => item.id === recordId);
    if (!record || record.status !== "completed" || get().isSaving) return;
    set({ isSaving: true, syncError: null });
    try {
      await reopenAttentionRecord(recordId);
      captureAttempt += 1;
      set((state) => ({
        records: replaceRecord(state.records, recordId, (item) => ({ ...item, status: "active" })),
        activeRecordId: recordId,
        procedureType: record.procedureType,
        messages: record.messages,
        notes: record.notes,
        notesDirty: false,
        captureStatus: "idle",
        captureText: "",
        captureScore: null,
        captureProgress: 0,
        captureError: null,
        draft: "",
        draftError: null,
        syncError: null,
      }));
    } catch (error) {
      set({ syncError: error instanceof Error ? error.message : "No se pudo reabrir la atención." });
    } finally {
      set({ isSaving: false });
    }
  },
}));
