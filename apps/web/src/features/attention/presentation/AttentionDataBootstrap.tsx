"use client";

import { useEffect, type ReactNode } from "react";
import { useAttentionStore } from "../application/attention-store";

export function AttentionDataBootstrap({ children }: { children: ReactNode }) {
  const loadRecords = useAttentionStore((state) => state.loadRecords);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  return children;
}
