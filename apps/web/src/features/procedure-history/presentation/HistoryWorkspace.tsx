"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import { useAttentionStore } from "@/features/attention/application/attention-store";
import { filterHistory, type HistoryFilters as HistoryFiltersType } from "../application/filter-history";
import type { HistoryRecord } from "../domain/types";
import { HistoryDetailPanel } from "./components/HistoryDetailPanel";
import { HistoryFilters } from "./components/HistoryFilters";
import { HistoryTable } from "./components/HistoryTable";

const PAGE_SIZE = 10;

export function HistoryWorkspace() {
  const router = useRouter();
  const records = useAttentionStore((state) => state.records);
  const isReady = useAttentionStore((state) => state.isReady);
  const syncError = useAttentionStore((state) => state.syncError);
  const loadRecords = useAttentionStore((state) => state.loadRecords);
  const reopenAttention = useAttentionStore((state) => state.reopenAttention);
  const [filters, setFilters] = useState<HistoryFiltersType>({
    query: "",
    status: "all",
    dateRange: "30days",
  });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const filteredRecords = filterHistory(records, filters);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRecords = filteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const effectiveSelectedId = pageRecords.some((record) => record.id === selectedId)
    ? selectedId
    : pageRecords[0]?.id ?? "";
  const selectedRecord = filteredRecords.find((record) => record.id === effectiveSelectedId);

  function changeFilters(next: HistoryFiltersType) {
    setFilters(next);
    setPage(1);
  }

  function clearFilters() {
    setFilters({ query: "", status: "all", dateRange: "30days" });
    setPage(1);
  }

  async function handleReopen(recordId: string) {
    await reopenAttention(recordId);
    if (useAttentionStore.getState().syncError) return;
    router.push("/atender");
  }

  if (!isReady) {
    return <div className="workspace-loading" role="status"><span className="spinner" aria-hidden="true" /> Cargando historial guardado…</div>;
  }

  return (
    <div className="workspace-page history-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Registros de tu cuenta de personal</p>
          <h1>Historial de trámites</h1>
          <p>Consulta y revisa las atenciones realizadas.</p>
        </div>
        <span className="history-demo-note"><History size={15} aria-hidden="true" /> Datos guardados en Supabase</span>
      </header>

      {syncError ? (
        <p className="sync-error" role="alert">
          {syncError} <button type="button" onClick={() => void loadRecords()}>Volver a cargar</button>
        </p>
      ) : null}

      <HistoryFilters filters={filters} onChange={changeFilters} onClear={clearFilters} />

      <div className="history-layout">
        <HistoryTable
          records={filteredRecords}
          selectedId={effectiveSelectedId}
          page={safePage}
          pageSize={PAGE_SIZE}
          onSelect={(record: HistoryRecord) => setSelectedId(record.id)}
          onPageChange={setPage}
          onClearFilters={clearFilters}
        />
        <HistoryDetailPanel record={selectedRecord} onReopen={handleReopen} />
      </div>
    </div>
  );
}
