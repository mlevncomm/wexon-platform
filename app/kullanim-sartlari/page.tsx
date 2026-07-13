import type { Metadata } from "next";
import LegalDocumentPage from "@/components/marketing/LegalDocumentPage";
import { getLegalDocument } from "@/lib/legal-content";

const document = getLegalDocument("kullanimSartlari");

export const metadata: Metadata = {
  title: document.metaTitle,
  description: document.metaDescription,
  alternates: { canonical: "/kullanim-sartlari" },
  robots: { index: true, follow: true },
};

export default function KullanimSartlariPage() {
  return <LegalDocumentPage document={document} />;
}
