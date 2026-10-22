import { Check, Circle, Clock3, X } from "lucide-react";
import type { ProcedureStatus } from "@/features/procedure-history/domain/types";

const statusLabels: Record<ProcedureStatus, string> = {
  active: "En atención",
  completed: "Finalizada",
  cancelled: "Cancelada",
};

export function StatusIndicator({ status }: { status: ProcedureStatus }) {
  const Icon = status === "active" ? Clock3 : status === "completed" ? Check : X;
  return (
    <span className={`status-pill status-pill--${status}`}>
      <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
      <span>{statusLabels[status]}</span>
    </span>
  );
}

export function ReadyIndicator({ label = "Listo" }: { label?: string }) {
  return (
    <span className="status-pill status-pill--ready">
      <Circle size={10} fill="currentColor" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
