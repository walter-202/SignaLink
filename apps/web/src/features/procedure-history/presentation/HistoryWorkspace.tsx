"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, History } from "lucide-react";
import { useAttentionStore } from "@/features/attention/application/attention-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { filterHistory, type HistoryFilters as HistoryFiltersType } from "../application/filter-history";
import type { HistoryRecord } from "../domain/types";
import { HistoryDetailPanel } from "./components/HistoryDetailPanel";
import { HistoryFilters } from "./components/HistoryFilters";
import { HistoryTable } from "./components/HistoryTable";

const PAGE_SIZE = 10;

export function HistoryWorkspace() {
  const router = useRouter();
  const records = useAttentionStore((state) => state.records);
  const reopenAttention = useAttentionStore((state) => state.reopenAttention);
  const loadHistory = useAttentionStore((state) => state.loadHistory);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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

  function handleReopen(recordId: string) {
    reopenAttention(recordId);
    router.push("/atender");
  }

  return (
    <div className="workspace-page history-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Consultas y registro histórico de atenciones</p>
          <h1>Historial de trámites</h1>
          <p>Consulta y revisa las atenciones realizadas con persistencia en Supabase.</p>
        </div>
        {isConfigured ? (
          <span className="history-demo-note" style={{ borderColor: "#10b981", color: "#065f46" }}>
            <CheckCircle2 size={15} aria-hidden="true" color="#059669" /> Supabase conectado · Persistencia activa
          </span>
        ) : (
          <span className="history-demo-note">
            <History size={15} aria-hidden="true" /> Datos de demostración
          </span>
        )}
      </header>

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
