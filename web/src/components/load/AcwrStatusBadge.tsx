import { Badge } from "@/components/ui/Badge";
import type { AcwrStatus } from "@/types/acwr";

interface Props {
  status: AcwrStatus;
}

const STATUS_CONFIG: Record<
  AcwrStatus,
  { label: string; variant: "emerald" | "amber" | "red" | "slate" | "primary" }
> = {
  low: { label: "LOW", variant: "slate" },
  ok: { label: "OK", variant: "emerald" },
  warning: { label: "VIGILANCE", variant: "amber" },
  alert: { label: "ALERTE", variant: "red" },
  insufficient_data: { label: "INCOMPLET", variant: "slate" },
};

export function AcwrStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
