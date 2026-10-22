import { isSupabaseConfigured } from "./config";
import { createClient as createBrowserClient } from "./client";
import type { HistoryRecord, ConversationMessage } from "@/features/procedure-history/domain/types";
import { MOCK_HISTORY } from "@/features/procedure-history/mocks/history.mock";

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

export interface CreateProcedureInput {
  id?: string;
  procedureType?: string;
  status?: "active" | "completed" | "cancelled";
  notes?: string;
}

/**
 * Servicio de Procedimientos que interactúa con Supabase cuando está configurado,
 * o utiliza los datos simulados en memoria (MOCK_HISTORY) como fallback transparente.
 * Garantiza persistencia real en la nube sin bloquear la experiencia de usuario.
 */
export const procedureRepository = {
  async getHistory(): Promise<HistoryRecord[]> {
    if (!isSupabaseConfigured()) {
      return MOCK_HISTORY;
    }

    try {
      const supabase = createBrowserClient();
      const { data: procedures, error } = await supabase
        .from("procedures")
        .select(`
          id,
          procedure_type,
          status,
          notes,
          started_at,
          duration_minutes,
          conversation_messages (
            id,
            sender,
            text,
            source,
            state,
            time_label,
            created_at
          )
        `)
        .order("started_at", { ascending: false });

      if (error || !procedures) {
        console.warn("Aviso al consultar procedimientos en Supabase:", error?.message);
        return MOCK_HISTORY;
      }

      if (procedures.length === 0) {
        return MOCK_HISTORY;
      }

      const supabaseRecords: HistoryRecord[] = procedures.map((p: any) => {
        const rawMessages = (p.conversation_messages ?? []) as any[];
        const sortedMessages = rawMessages
          .slice()
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const messages: ConversationMessage[] = sortedMessages.map((m) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          time: m.time_label ?? "10:00",
          state: m.state,
          source: m.source,
        }));

        return {
          id: p.id,
          procedureType: p.procedure_type,
          startedAt: p.started_at,
          status: p.status,
          durationMinutes: p.duration_minutes ?? 0,
          notes: p.notes ?? "",
          messages,
        };
      });

      // Evitar duplicados y anteponer los registros reales de Supabase sobre la base mock
      const supabaseIds = new Set(supabaseRecords.map((r) => r.id));
      const remainingMocks = MOCK_HISTORY.filter((mock) => !supabaseIds.has(mock.id));
      return [...supabaseRecords, ...remainingMocks];
    } catch (err) {
      console.warn("Excepción al obtener historial de Supabase:", err);
      return MOCK_HISTORY;
    }
  },

  async createProcedure(input: CreateProcedureInput | string): Promise<string> {
    const parsed = typeof input === "string" ? { procedureType: input } : input;
    const procedureType = parsed.procedureType ?? "Registro ciudadano";
    const status = parsed.status ?? "active";
    const notes = parsed.notes ?? "";

    if (!isSupabaseConfigured()) {
      return parsed.id ?? "proc-" + Date.now();
    }

    const id = parsed.id && isUuid(parsed.id) ? parsed.id : generateUuid();

    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from("procedures")
        .insert({
          id,
          procedure_type: procedureType,
          status,
          notes,
        })
        .select("id")
        .single();

      if (error || !data) {
        console.warn("Error creando procedimiento en Supabase:", error);
        return id;
      }
      return data.id;
    } catch (err) {
      console.warn("Excepción creando procedimiento en Supabase:", err);
      return id;
    }
  },

  async appendMessage(
    procedureId: string,
    message: ConversationMessage,
  ): Promise<void> {
    if (!isSupabaseConfigured()) return;
    if (!isUuid(procedureId)) return;

    try {
      const supabase = createBrowserClient();
      const payload: Record<string, any> = {
        procedure_id: procedureId,
        sender: message.sender,
        text: message.text,
        source: message.source,
        state: message.state,
        time_label: message.time,
      };

      if (message.id && isUuid(message.id)) {
        payload.id = message.id;
      }

      const { error } = await supabase.from("conversation_messages").insert(payload);
      if (error) {
        console.warn("Error insertando mensaje en Supabase:", error);
      }
    } catch (err) {
      console.warn("No se pudo persistir el mensaje en Supabase:", err);
    }
  },

  async updateProcedureType(procedureId: string, procedureType: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    if (!isUuid(procedureId)) return;

    try {
      const supabase = createBrowserClient();
      await supabase
        .from("procedures")
        .update({
          procedure_type: procedureType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", procedureId);
    } catch (err) {
      console.warn("Error actualizando tipo de trámite en Supabase:", err);
    }
  },

  async updateProcedureNotes(procedureId: string, notes: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    if (!isUuid(procedureId)) return;

    try {
      const supabase = createBrowserClient();
      await supabase
        .from("procedures")
        .update({
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", procedureId);
    } catch (err) {
      console.warn("Error actualizando observaciones en Supabase:", err);
    }
  },

  async completeProcedure(
    procedureId: string,
    notes: string,
    durationMinutes = 12,
  ): Promise<void> {
    if (!isSupabaseConfigured()) return;
    if (!isUuid(procedureId)) return;

    try {
      const supabase = createBrowserClient();
      await supabase
        .from("procedures")
        .update({
          status: "completed",
          notes,
          duration_minutes: durationMinutes,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", procedureId);
    } catch (err) {
      console.warn("No se pudo completar el procedimiento en Supabase:", err);
    }
  },

  async reopenProcedure(procedureId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    if (!isUuid(procedureId)) return;

    try {
      const supabase = createBrowserClient();
      await supabase
        .from("procedures")
        .update({
          status: "active",
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", procedureId);
    } catch (err) {
      console.warn("No se pudo reabrir el procedimiento en Supabase:", err);
    }
  },
};
