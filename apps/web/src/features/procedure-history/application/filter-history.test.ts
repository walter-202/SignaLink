import { describe, expect, it } from "vitest";
import { filterHistory } from "./filter-history";
import { MOCK_HISTORY, MOCK_HISTORY_ANCHOR } from "../mocks/history.mock";
import type { HistoryRecord } from "../domain/types";

describe("filterHistory", () => {
  it("includes the full selected calendar range and sorts newest first", () => {
    const results = filterHistory(MOCK_HISTORY, {
      query: "",
      status: "all",
      dateRange: "30days",
    });

    expect(results).toHaveLength(18);
    expect(results[0]?.id).toBe("AT-2024-0018");
    expect(results.at(-1)?.id).toBe("AT-2024-0001");
  });

  it("searches by reference, procedure, and conversation content", () => {
    expect(filterHistory(MOCK_HISTORY, { query: "0017", status: "all", dateRange: "all" })[0]?.id).toBe("AT-2024-0017");
    expect(filterHistory(MOCK_HISTORY, { query: "nacimiento", status: "all", dateRange: "all" })[0]?.procedureType).toBe("Certificado de nacimiento");
    expect(filterHistory(MOCK_HISTORY, { query: "documento de identidad", status: "all", dateRange: "all" })).toHaveLength(1);
  });

  it("applies status and today filters together", () => {
    const results = filterHistory(MOCK_HISTORY, {
      query: "",
      status: "active",
      dateRange: "today",
    }, MOCK_HISTORY_ANCHOR);

    expect(results.map((record) => record.id)).toEqual(["AT-2024-0018"]);
  });

  it("incluye registros recién creados de Supabase (hoy) en los filtros all, today y 30days", () => {
    const todayRecord: HistoryRecord = {
      id: "proc-hoy",
      procedureType: "Registro ciudadano",
      startedAt: new Date().toISOString(),
      status: "completed",
      durationMinutes: 10,
      messages: [],
      notes: "Prueba hoy",
    };

    const combined = [todayRecord, ...MOCK_HISTORY];

    const resultsAll = filterHistory(combined, { query: "", status: "all", dateRange: "all" });
    expect(resultsAll.length).toBe(19);
    expect(resultsAll[0]?.id).toBe("proc-hoy");

    const resultsToday = filterHistory(combined, { query: "", status: "all", dateRange: "today" });
    expect(resultsToday.some((r) => r.id === "proc-hoy")).toBe(true);

    const results30Days = filterHistory(combined, { query: "", status: "all", dateRange: "30days" });
    expect(results30Days.some((r) => r.id === "proc-hoy")).toBe(true);
  });
});
