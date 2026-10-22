import { isSupabaseConfigured } from "./config";
import { createClient as createBrowserClient } from "./client";
import type { HistoryRecord, ConversationMessage } from "@/features/procedure-history/domain/types";
import { MOCK_HISTORY } from "@/features/procedure-history/mocks/history.mock";

/**
 * Servicio de Procedimientos que interactúa con Supabase si está configurado,
 * o utiliza los datos simulados en memoria (MOCK_HISTORY) como fallback transparente.
 * Garantiza que nada se rompa si Supabase no tiene credenciales en el entorno.
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

      if (error || !procedures || procedures.length === 0) {
        return MOCK_HISTORY;
      }

      return procedures.map((p: any) => ({
        id: p.id,
        procedureType: p.procedure_type,
        startedAt: p.started_at,
        status: p.status,
        durationMinutes: p.duration_minutes ?? 0,
        notes: p.notes ?? "",
        messages: (p.conversation_messages ?? []).map((m: any) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          time: m.time_label ?? "10:00",
          state: m.state,
          source: m.source,
        })),
      }));
    } catch {
      return MOCK_HISTORY;
    }
  },

  async createProcedure(procedureType: string): Promise<string> {
    if (!isSupabaseConfigured()) {
      return "proc-" + Date.now();
    }

    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from("procedures")
        .insert({
          procedure_type: procedureType,
          status: "active",
        })
        .select("id")
        .single();

      if (error || !data) {
        return "proc-" + Date.now();
      }
      return data.id;
    } catch {
      return "proc-" + Date.now();
    }
  },

  async appendMessage(
    procedureId: string,
    message: Omit<ConversationMessage, "id">,
  ): Promise<void> {
    if (!isSupabaseConfigured()) return;

    try {
      const supabase = createBrowserClient();
      await supabase.from("conversation_messages").insert({
        procedure_id: procedureId,
        sender: message.sender,
        text: message.text,
        source: message.source,
        state: message.state,
        time_label: message.time,
      });
    } catch (err) {
      console.warn("No se pudo persistir el mensaje en Supabase:", err);
    }
  },

  async completeProcedure(procedureId: string, notes: string): Promise<void> {
    if (!isSupabaseConfigured()) return;

    try {
      const supabase = createBrowserClient();
      await supabase
        .from("procedures")
        .update({
          status: "completed",
          notes,
          completed_at: new Date().toISOString(),
        })
        .eq("id", procedureId);
    } catch (err) {
      console.warn("No se pudo completar el procedimiento en Supabase:", err);
    }
  },
};
