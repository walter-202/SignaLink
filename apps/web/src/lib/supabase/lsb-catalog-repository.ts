import { isSupabaseConfigured } from "./config";
import { createClient as createBrowserClient } from "./client";

export interface LsbSignRecord {
  id: string;
  moduleId: string;
  level: string;
  category: string;
  numberInCategory: number;
  labelEs: string;
  gloss: string;
  hasVariants: boolean;
  pdfPage: number | null;
  numFrames: number;
  isMultiphase: boolean;
  frames: any[];
}

export const lsbCatalogRepository = {
  async searchSigns(term: string): Promise<LsbSignRecord[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const supabase = createBrowserClient();
      const cleanTerm = term.trim().toUpperCase();
      const { data, error } = await supabase
        .from("lsb_signs_catalog")
        .select("*")
        .or(`gloss.ilike.%${cleanTerm}%,label_es.ilike.%${cleanTerm}%`)
        .limit(25);

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        moduleId: row.module_id,
        level: row.level,
        category: row.category,
        numberInCategory: row.number_in_category,
        labelEs: row.label_es,
        gloss: row.gloss,
        hasVariants: row.has_variants,
        pdfPage: row.pdf_page,
        numFrames: row.num_frames,
        isMultiphase: row.is_multiphase,
        frames: row.frames,
      }));
    } catch {
      return [];
    }
  },
};
