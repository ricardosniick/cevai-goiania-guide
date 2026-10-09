import type { ReactNode } from "react";
import { formatKm } from "@/lib/geo-format";

/** Keep distance, its icon and surrounding words/separators as one removable unit. */
export function DistanceText({ km, prefix = "", suffix = "", className, as: Tag = "span", children }: {
  km: number; prefix?: string; suffix?: string; className?: string; as?: "span" | "p"; children?: ReactNode;
}) {
  const label = formatKm(km);
  if (!label) return null;
  return <Tag className={className}>{children}{prefix}{label}{suffix}</Tag>;
}
