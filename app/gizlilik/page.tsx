import type { Metadata } from "next";
import LegalDocumentPage from "@/components/marketing/LegalDocumentPage";
import { getLegalDocument } from "@/lib/legal-content";

const document = getLegalDocument("gizlilik");

export const metadata: Metadata = {
  title: document.metaTitle,
  description: document.metaDescription,
  alternates: { canonical: "/gizlilik" },
  robots: { index: true, follow: true },
};

export default function GizlilikPage() {
  return <LegalDocumentPage document={document} />;
}
