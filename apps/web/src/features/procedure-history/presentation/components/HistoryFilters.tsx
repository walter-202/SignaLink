"use client";

import { CalendarDays, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select, type SelectOption } from "@/components/ui/Select";
import type { HistoryDateRange, HistoryFilters as HistoryFiltersType } from "../../application/filter-history";

interface HistoryFiltersProps {
  filters: HistoryFiltersType;
  onChange: (filters: HistoryFiltersType) => void;
  onClear: () => void;
}

const statusOptions: SelectOption[] = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "En atención" },
  { value: "completed", label: "Finalizada" },
  { value: "cancelled", label: "Cancelada" },
];

const dateOptions: SelectOption[] = [
  { value: "today", label: "Hoy" },
  { value: "7days", label: "Últimos 7 días" },
  { value: "30days", label: "Últimos 30 días" },
  { value: "all", label: "Todas las fechas" },
];

export function HistoryFilters({ filters, onChange, onClear }: HistoryFiltersProps) {
  return (
    <section className="history-filters" aria-label="Filtros del historial">
      <label className="search-field">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Buscar por referencia, trámite o conversación</span>
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.currentTarget.value })}
          placeholder="Buscar por ID, trámite o palabras clave…"
        />
      </label>
      <div className="filter-select-wrap">
        <label className="field-label" htmlFor="history-status">Estado</label>
        <Select
          id="history-status"
          label="Filtrar por estado"
          value={filters.status}
          options={statusOptions}
          onValueChange={(status) => onChange({ ...filters, status: status as HistoryFiltersType["status"] })}
        />
      </div>
      <div className="filter-select-wrap">
        <label className="field-label" htmlFor="history-date"><CalendarDays size={13} aria-hidden="true" /> Fecha</label>
        <Select
          id="history-date"
          label="Filtrar por fecha"
          value={filters.dateRange}
          options={dateOptions}
          onValueChange={(dateRange) => onChange({ ...filters, dateRange: dateRange as HistoryDateRange })}
        />
      </div>
      <Button className="clear-filters-button" size="icon" variant="ghost" onClick={onClear} aria-label="Limpiar filtros" title="Limpiar filtros">
        <RotateCcw size={16} aria-hidden="true" />
      </Button>
    </section>
  );
}
