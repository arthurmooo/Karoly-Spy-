export type SortDirection = "asc" | "desc";

export type SortValue = string | number | null | undefined | Date;

export interface SortState<Column extends string = string> {
  column: Column;
  direction: SortDirection;
}

export function toggleSortDirection(current?: SortDirection): SortDirection {
  return current === "asc" ? "desc" : "asc";
}

function normalizeSortValue(value: Exclude<SortValue, null | undefined>): string | number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return value.toLocaleLowerCase("fr-FR");
  return value;
}

export function compareSortValues(a: SortValue, b: SortValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const normalizedA = normalizeSortValue(a);
  const normalizedB = normalizeSortValue(b);

  if (typeof normalizedA === "number" && typeof normalizedB === "number") {
    return normalizedA - normalizedB;
  }

  return String(normalizedA).localeCompare(String(normalizedB), "fr", {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortRows<Row>(
  rows: Row[],
  getValue: (row: Row) => SortValue,
  direction: SortDirection
): Row[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => multiplier * compareSortValues(getValue(left), getValue(right)));
}

export function getAriaSort(
  active: boolean,
  direction?: SortDirection
): "none" | "ascending" | "descending" {
  if (!active || !direction) return "none";
  return direction === "asc" ? "ascending" : "descending";
}
