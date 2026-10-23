export type ProcedureStatus = "active" | "completed" | "cancelled";
export type MessageSender = "citizen" | "staff";
export type MessageState = "confirmed" | "sent" | "pending";

export interface ConversationMessage {
  id: string;
  sender: MessageSender;
  text: string;
  time: string;
  state: MessageState;
  source: "reviewed-sign" | "typed" | "frequent-phrase" | "dictation";
}

export interface HistoryRecord {
  id: string;
  procedureType: string;
  startedAt: string;
  status: ProcedureStatus;
  durationMinutes: number;
  messages: ConversationMessage[];
  notes: string;
}
