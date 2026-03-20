import { useCallback, useState } from "react";
import type { AthleteKpiReport } from "@/services/stats.service";
import type { AcwrMetricSnapshot } from "@/types/acwr";

export function useExportBilan() {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(
    async (
      report: AthleteKpiReport,
      athleteName: string,
      acwrMetrics?: AcwrMetricSnapshot[],
    ) => {
      setIsExporting(true);
      try {
        const { exportBilanPdf } = await import("@/services/pdfExport.service");
        await exportBilanPdf({ report, athleteName, acwrMetrics });
      } catch (err) {
        console.error("PDF export failed:", err);
      } finally {
        setIsExporting(false);
      }
    },
    [],
  );

  return { exportPdf, isExporting };
}
