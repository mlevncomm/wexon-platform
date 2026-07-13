import type { Metadata } from "next";
import LegalDocumentPage from "@/components/marketing/LegalDocumentPage";
import { getLegalDocument } from "@/lib/legal-content";

const document = getLegalDocument("kvkk");

export const metadata: Metadata = {
  title: document.metaTitle,
  description: document.metaDescription,
  alternates: { canonical: "/kvkk" },
  robots: { index: true, follow: true },
};

export default function KvkkPage() {
  return <LegalDocumentPage document={document} />;
}
