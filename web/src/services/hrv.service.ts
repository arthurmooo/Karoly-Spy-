import type { Athlete } from "@/types/athlete";

interface HrvRow {
  email: string;
  date: string;
  time: string;
  resting_hr: number | null;
  rmssd: number | null;
}

export function parseHrvCsv(text: string): HrvRow[] {
  const lines = text.trim().split("\n");
  // Skip header if present
  const start = lines[0]?.includes("@") ? 0 : 1;
  const rows: HrvRow[] = [];

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i]!.split(";").map((c) => c.trim());
    if (cols.length < 5) continue;
    rows.push({
      email: cols[0]!,
      date: cols[1]!,
      time: cols[2]!,
      resting_hr: cols[3] ? parseFloat(cols[3]) : null,
      rmssd: cols[4] ? parseFloat(cols[4]) : null,
    });
  }
  return rows;
}

export function matchEmailToAthlete(
  email: string,
  athletes: Athlete[]
): Athlete | undefined {
  return athletes.find(
    (a) => a.email?.toLowerCase() === email.toLowerCase()
  );
}

export function computeTrend(
  current: number | null,
  avg30d: number | null
): number | null {
  if (!current || !avg30d || avg30d === 0) return null;
  return ((current - avg30d) / avg30d) * 100;
}
