import { describe, it, expect, vi, beforeEach } from "vitest";
import { procedureRepository } from "./procedure-repository";
import { lsbCatalogRepository } from "./lsb-catalog-repository";
import * as config from "./config";
import { MOCK_HISTORY } from "@/features/procedure-history/mocks/history.mock";

describe("Supabase Repositories Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve MOCK_HISTORY cuando Supabase no está configurado (Fallback seguro)", async () => {
    vi.spyOn(config, "isSupabaseConfigured").mockReturnValue(false);

    const history = await procedureRepository.getHistory();
    expect(history).toEqual(MOCK_HISTORY);
    expect(history.length).toBeGreaterThan(0);
  });

  it("genera un ID local cuando Supabase no está configurado al crear procedimiento", async () => {
    vi.spyOn(config, "isSupabaseConfigured").mockReturnValue(false);

    const id = await procedureRepository.createProcedure("Trámite general");
    expect(id).toMatch(/^proc-\d+$/);
  });

  it("devuelve arreglo vacío de señas cuando Supabase no está configurado sin lanzar excepción", async () => {
    vi.spyOn(config, "isSupabaseConfigured").mockReturnValue(false);

    const results = await lsbCatalogRepository.searchSigns("HOLA");
    expect(results).toEqual([]);
  });
});
