import type { HistoryRecord, ProcedureStatus } from "../domain/types";

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
  const cutoff = new Date(anchor);
  if (filters.dateRange === "7days") cutoff.setDate(cutoff.getDate() - 7);
  if (filters.dateRange === "30days") cutoff.setDate(cutoff.getDate() - 30);
  const inclusiveCutoff = startOfLocalDay(cutoff);

  return records
    .filter((record) => filters.status === "all" || record.status === filters.status)
    .filter((record) => {
      if (filters.dateRange === "all") return true;
      const recordTime = new Date(record.startedAt).getTime();
      if (filters.dateRange === "today") {
        return startOfLocalDay(new Date(record.startedAt)) === startOfLocalDay(anchor);
      }
      return recordTime >= inclusiveCutoff && recordTime <= anchor.getTime();
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

export function formatProcedureDateTime(value: string, anchor: Date = new Date()): string {
  const date = new Date(value);
  const dateLabel = formatProcedureDate(value);
  const timeLabel = new Intl.DateTimeFormat("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const anchorDay = startOfLocalDay(anchor);
  const recordDay = startOfLocalDay(date);
  if (recordDay === anchorDay) return `Hoy, ${timeLabel}`;
  if (recordDay === anchorDay - 86_400_000) return `Ayer, ${timeLabel}`;
  return `${dateLabel}, ${timeLabel}`;
}
