import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import {
  BilanPdfDocument,
  type BilanPdfDocumentProps,
} from "@/components/export/BilanPdfDocument";

export async function exportBilanPdf(
  props: BilanPdfDocumentProps,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = createElement(BilanPdfDocument, props) as any;
  const blob = await pdf(doc).toBlob();

  const athleteSlug = props.athleteName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const periodSlug = props.report.period === "week" ? "semaine" : "mois";
  const fileName = `bilan_${athleteSlug}_${periodSlug}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
