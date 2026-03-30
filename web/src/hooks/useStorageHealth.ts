import { useEffect, useState } from "react";
import { getStorageUsage, type SystemMonitoringRow } from "@/repositories/system.repository";

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export type StorageStatus = "ok" | "warning" | "critical" | null;

export interface StorageHealth {
  storage: SystemMonitoringRow | null;
  isLoading: boolean;
  isStale: boolean;
  pct: number;
  status: StorageStatus;
}

export function useStorageHealth(): StorageHealth {
  const [storage, setStorage] = useState<SystemMonitoringRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStorageUsage()
      .then(setStorage)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const valueGb = storage?.value_gb ?? 0;
  const limitGb = storage?.limit_gb ?? 100;
  const pct = limitGb > 0 ? Math.round((valueGb / limitGb) * 1000) / 10 : 0;

  const status: StorageStatus = storage
    ? pct >= 90
      ? "critical"
      : pct >= 80
        ? "warning"
        : "ok"
    : null;

  const isStale = storage?.checked_at
    ? Date.now() - new Date(storage.checked_at).getTime() > STALE_THRESHOLD_MS
    : false;

  return { storage, isLoading, isStale, pct, status };
}
