"use client";

import { ChevronLeft, ChevronRight, FileClock, SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusIndicator } from "@/components/feedback/StatusIndicator";
import { formatProcedureDateTime } from "../../application/filter-history";
import type { HistoryRecord } from "../../domain/types";

interface HistoryTableProps {
  records: HistoryRecord[];
  selectedId: string;
  page: number;
  pageSize: number;
  onSelect: (record: HistoryRecord) => void;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
}

export function HistoryTable({
  records,
  selectedId,
  page,
  pageSize,
  onSelect,
  onPageChange,
  onClearFilters,
}: HistoryTableProps) {
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const pageRecords = records.slice((page - 1) * pageSize, page * pageSize);
  const firstItem = records.length ? (page - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(page * pageSize, records.length);

  return (
    <section className="panel-card history-list-card" aria-labelledby="history-list-title">
      <header className="history-list-heading">
        <h2 id="history-list-title">Lista de atenciones</h2>
        <span className="results-count">{records.length} resultados</span>
      </header>

      {records.length === 0 ? (
        <div className="history-empty" role="status">
          <SearchX size={28} aria-hidden="true" />
          <strong>No encontramos atenciones</strong>
          <span>Prueba con otro término o limpia los filtros.</span>
          <Button variant="secondary" size="small" onClick={onClearFilters}>Limpiar filtros</Button>
        </div>
      ) : (
        <>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">ID / Referencia</th>
                  <th scope="col">Tipo de trámite</th>
                  <th scope="col">Fecha y hora</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Duración</th>
                  <th scope="col"><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                {pageRecords.map((record) => (
                  <tr className={record.id === selectedId ? "history-row history-row--selected" : "history-row"} key={record.id} aria-selected={record.id === selectedId}>
                    <td><span className="record-id">{record.id}</span></td>
                    <td>{record.procedureType}</td>
                    <td>{formatProcedureDateTime(record.startedAt)}</td>
                    <td><StatusIndicator status={record.status} /></td>
                    <td>{record.durationMinutes} min</td>
                    <td><button className="table-action" type="button" onClick={() => onSelect(record)} aria-label={`Ver detalle de ${record.id}`}>Ver detalle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="history-mobile-list">
            {pageRecords.map((record) => (
              <button
                className={`history-mobile-card ${record.id === selectedId ? "history-mobile-card--selected" : ""}`}
                type="button"
                key={record.id}
                onClick={() => onSelect(record)}
                aria-pressed={record.id === selectedId}
              >
                <span className="history-mobile-card-heading"><strong>{record.id}</strong><StatusIndicator status={record.status} /></span>
                <span>{record.procedureType}</span>
                <span className="history-mobile-meta"><time>{formatProcedureDateTime(record.startedAt)}</time><span>{record.durationMinutes} min</span></span>
                <span className="history-mobile-action">Ver detalle <ChevronRight size={15} aria-hidden="true" /></span>
              </button>
            ))}
          </div>

          <footer className="history-pagination">
            <div className="pagination-summary">Mostrar <strong>{pageSize}</strong> · {firstItem}–{lastItem} de {records.length}</div>
            <nav className="pagination-controls" aria-label="Paginación del historial">
              <Button variant="secondary" size="icon" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Página anterior">
                <ChevronLeft size={17} aria-hidden="true" />
              </Button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                <Button
                  className={page === pageNumber ? "pagination-current" : ""}
                  variant={page === pageNumber ? "primary" : "secondary"}
                  size="small"
                  key={pageNumber}
                  onClick={() => onPageChange(pageNumber)}
                  aria-current={page === pageNumber ? "page" : undefined}
                  aria-label={`Página ${pageNumber}`}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button variant="secondary" size="icon" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} aria-label="Página siguiente">
                <ChevronRight size={17} aria-hidden="true" />
              </Button>
            </nav>
          </footer>
        </>
      )}
      {records.length > 0 ? <p className="list-hint"><FileClock size={13} aria-hidden="true" /> Cada atención solo es visible desde la cuenta que la registró.</p> : null}
    </section>
  );
}
