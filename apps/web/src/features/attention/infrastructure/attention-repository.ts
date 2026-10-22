import { createClient } from "@/lib/supabase/client";
import type { ConversationMessage, HistoryRecord, ProcedureStatus } from "@/features/procedure-history/domain/types";

interface AttentionRow {
  id: string;
  reference: string;
  procedure_type: string;
  status: ProcedureStatus;
  started_at: string;
  duration_minutes: number;
  notes: string;
}

interface MessageRow {
  id: string;
  attention_id: string;
  sender: ConversationMessage["sender"];
  body: string;
  source: ConversationMessage["source"];
  state: ConversationMessage["state"];
  created_at: string;
}

const ATTENTION_COLUMNS = "id, reference, procedure_type, status, started_at, duration_minutes, notes";
const MESSAGE_COLUMNS = "id, attention_id, sender, body, source, state, created_at";

function raiseDatabaseError(context: string, error: unknown): never {
  console.error(`[attention-repository] ${context}`, error);
  throw new Error(context);
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function toMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    sender: row.sender,
    text: row.body,
    time: formatMessageTime(row.created_at),
    state: row.state,
    source: row.source,
  };
}

function toHistoryRecord(row: AttentionRow, messages: ConversationMessage[] = []): HistoryRecord {
  return {
    id: row.reference,
    procedureType: row.procedure_type,
    startedAt: row.started_at,
    status: row.status,
    durationMinutes: row.duration_minutes,
    messages,
    notes: row.notes,
  };
}

export async function listAttentionRecords(): Promise<HistoryRecord[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("attentions")
    .select(ATTENTION_COLUMNS)
    .order("started_at", { ascending: false });

  if (error) raiseDatabaseError("No se pudo cargar el historial. Intenta de nuevo.", error);
  const attentions = (rows ?? []) as unknown as AttentionRow[];
  if (!attentions.length) return [];

  const { data: messageRows, error: messagesError } = await supabase
    .from("attention_messages")
    .select(MESSAGE_COLUMNS)
    .in("attention_id", attentions.map((record) => record.id))
    .order("created_at", { ascending: true });

  if (messagesError) raiseDatabaseError("No se pudieron cargar los mensajes de las atenciones.", messagesError);

  const groupedMessages = new Map<string, ConversationMessage[]>();
  for (const row of (messageRows ?? []) as unknown as MessageRow[]) {
    const group = groupedMessages.get(row.attention_id) ?? [];
    group.push(toMessage(row));
    groupedMessages.set(row.attention_id, group);
  }

  return attentions.map((record) => toHistoryRecord(record, groupedMessages.get(record.id) ?? []));
}

export async function createAttentionRecord(procedureType: string): Promise<HistoryRecord> {
  const { data, error } = await createClient()
    .from("attentions")
    .insert({ procedure_type: procedureType })
    .select(ATTENTION_COLUMNS)
    .single();

  if (error || !data) raiseDatabaseError("No se pudo iniciar la atención. Revisa tu conexión e inténtalo de nuevo.", error);
  return toHistoryRecord(data as unknown as AttentionRow);
}

export async function updateAttentionRecord(
  reference: string,
  values: { procedureType?: string; notes?: string },
): Promise<void> {
  const supabase = createClient();
  const { data: current, error: findError } = await supabase
    .from("attentions")
    .select("id")
    .eq("reference", reference)
    .maybeSingle();

  if (findError || !current) raiseDatabaseError("No se encontró la atención para guardar los cambios.", findError);

  const update: Record<string, string> = {};
  if (values.procedureType !== undefined) update.procedure_type = values.procedureType;
  if (values.notes !== undefined) update.notes = values.notes;
  if (!Object.keys(update).length) return;

  const { error } = await supabase.from("attentions").update(update).eq("id", current.id);
  if (error) raiseDatabaseError("No se pudieron guardar los cambios de la atención.", error);
}

export async function addAttentionMessage(
  reference: string,
  message: Pick<ConversationMessage, "sender" | "text" | "source" | "state">,
): Promise<ConversationMessage> {
  const supabase = createClient();
  const { data: attention, error: findError } = await supabase
    .from("attentions")
    .select("id")
    .eq("reference", reference)
    .maybeSingle();

  if (findError || !attention) raiseDatabaseError("No se encontró la atención para guardar el mensaje.", findError);

  const { data, error } = await supabase
    .from("attention_messages")
    .insert({
      attention_id: attention.id,
      sender: message.sender,
      body: message.text,
      source: message.source,
      state: message.state,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error || !data) raiseDatabaseError("No se pudo guardar el mensaje en la conversación.", error);
  return toMessage(data as unknown as MessageRow);
}

export async function finishAttentionRecord(reference: string): Promise<Pick<HistoryRecord, "durationMinutes">> {
  const supabase = createClient();
  const { data: current, error: findError } = await supabase
    .from("attentions")
    .select("id, duration_minutes, session_started_at")
    .eq("reference", reference)
    .eq("status", "active")
    .maybeSingle();

  if (findError || !current) raiseDatabaseError("No se encontró una atención activa para finalizar.", findError);

  const currentRow = current as { id: string; duration_minutes: number; session_started_at: string };
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(currentRow.session_started_at)) / 60_000));
  const durationMinutes = currentRow.duration_minutes + elapsed;
  const { error } = await supabase
    .from("attentions")
    .update({ status: "completed", finished_at: new Date().toISOString(), duration_minutes: durationMinutes })
    .eq("id", currentRow.id)
    .eq("status", "active");

  if (error) raiseDatabaseError("No se pudo finalizar la atención.", error);
  return { durationMinutes };
}

export async function reopenAttentionRecord(reference: string): Promise<void> {
  const supabase = createClient();
  const { data: current, error: findError } = await supabase
    .from("attentions")
    .select("id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (findError || !current) raiseDatabaseError("No se encontró la atención que quieres reabrir.", findError);
  const currentRow = current as { id: string; status: ProcedureStatus };
  if (currentRow.status === "cancelled") throw new Error("No se puede reabrir una atención cancelada.");

  const { error } = await supabase
    .from("attentions")
    .update({ status: "active", finished_at: null, session_started_at: new Date().toISOString() })
    .eq("id", currentRow.id);

  if (error) raiseDatabaseError("No se pudo reabrir la atención.", error);
}
