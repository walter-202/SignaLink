import type { HistoryRecord, ProcedureStatus } from "../domain/types";
import { MOCK_HISTORY_ANCHOR } from "../mocks/history.mock";

export type HistoryDateRange = "today" | "7days" | "30days" | "all";

export interface HistoryFilters {
  query: string;
  status: ProcedureStatus | "all";
  dateRange: HistoryDateRange;
}

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function filterHistory(
  records: HistoryRecord[],
  filters: HistoryFilters,
  anchor: Date = new Date(),
): HistoryRecord[] {
  const query = filters.query.trim().toLocaleLowerCase("es-BO");

  return records
    .filter((record) => filters.status === "all" || record.status === filters.status)
    .filter((record) => {
      if (filters.dateRange === "all") return true;
      const recordDate = new Date(record.startedAt);
      const recordTime = recordDate.getTime();

      const now = anchor;
      const mockAnchor = MOCK_HISTORY_ANCHOR;

      if (filters.dateRange === "today") {
        return (
          startOfLocalDay(recordDate) === startOfLocalDay(now) ||
          startOfLocalDay(recordDate) === startOfLocalDay(mockAnchor)
        );
      }

      const days = filters.dateRange === "7days" ? 7 : 30;

      const cutoffNow = new Date(now);
      cutoffNow.setDate(cutoffNow.getDate() - days);
      const inNowRange = recordTime >= startOfLocalDay(cutoffNow) && recordTime <= now.getTime() + 86_400_000;

      const cutoffMock = new Date(mockAnchor);
      cutoffMock.setDate(cutoffMock.getDate() - days);
      const inMockRange = recordTime >= startOfLocalDay(cutoffMock) && recordTime <= mockAnchor.getTime() + 86_400_000;

      return inNowRange || inMockRange;
    })
    .filter((record) => {
      if (!query) return true;
      const searchable = [
        record.id,
        record.procedureType,
        ...record.messages.map((message) => message.text),
      ].join(" ").toLocaleLowerCase("es-BO");
      return searchable.includes(query);
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function formatProcedureDate(value: string): string {
  return new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatProcedureDateTime(value: string): string {
  const date = new Date(value);
  const dateLabel = formatProcedureDate(value);
  const timeLabel = new Intl.DateTimeFormat("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const today = startOfLocalDay(new Date());
  const anchorDay = startOfLocalDay(MOCK_HISTORY_ANCHOR);
  const recordDay = startOfLocalDay(date);

  if (recordDay === today || recordDay === anchorDay) return `Hoy, ${timeLabel}`;
  if (recordDay === today - 86_400_000 || recordDay === anchorDay - 86_400_000) return `Ayer, ${timeLabel}`;
  return `${dateLabel}, ${timeLabel}`;
}
