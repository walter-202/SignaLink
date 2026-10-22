export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      procedures: {
        Row: {
          id: string;
          procedure_type: string;
          status: "active" | "completed" | "cancelled";
          notes: string | null;
          started_at: string;
          completed_at: string | null;
          duration_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          procedure_type?: string;
          status?: "active" | "completed" | "cancelled";
          notes?: string | null;
          started_at?: string;
          completed_at?: string | null;
          duration_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          procedure_type?: string;
          status?: "active" | "completed" | "cancelled";
          notes?: string | null;
          started_at?: string;
          completed_at?: string | null;
          duration_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversation_messages: {
        Row: {
          id: string;
          procedure_id: string;
          sender: "citizen" | "staff";
          text: string;
          source: "reviewed-sign" | "typed" | "frequent-phrase" | "dictation" | "demo";
          state: "confirmed" | "sent" | "pending";
          time_label: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          procedure_id: string;
          sender: "citizen" | "staff";
          text: string;
          source?: "reviewed-sign" | "typed" | "frequent-phrase" | "dictation" | "demo";
          state?: "confirmed" | "sent" | "pending";
          time_label?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          procedure_id?: string;
          sender?: "citizen" | "staff";
          text?: string;
          source?: "reviewed-sign" | "typed" | "frequent-phrase" | "dictation" | "demo";
          state?: "confirmed" | "sent" | "pending";
          time_label?: string | null;
          created_at?: string;
        };
      };
      lsb_signs_catalog: {
        Row: {
          id: string;
          module_id: "M1" | "M2" | "M3" | "M4";
          level: string;
          category: string;
          category_idx: number;
          number_in_category: number;
          label_es: string;
          gloss: string;
          has_variants: boolean;
          pdf_page: number | null;
          num_frames: number;
          is_multiphase: boolean;
          frames: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          module_id: "M1" | "M2" | "M3" | "M4";
          level: string;
          category: string;
          category_idx: number;
          number_in_category: number;
          label_es: string;
          gloss: string;
          has_variants?: boolean;
          pdf_page?: number | null;
          num_frames?: number;
          is_multiphase?: boolean;
          frames?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: "M1" | "M2" | "M3" | "M4";
          level?: string;
          category?: string;
          category_idx?: number;
          number_in_category?: number;
          label_es?: string;
          gloss?: string;
          has_variants?: boolean;
          pdf_page?: number | null;
          num_frames?: number;
          is_multiphase?: boolean;
          frames?: Json;
          created_at?: string;
        };
      };
    };
  };
}
