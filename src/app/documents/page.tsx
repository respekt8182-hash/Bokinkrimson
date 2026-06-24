import type { Metadata } from "next";
import { LegalDocumentsHub } from "@/components/legal/legal-documents-hub";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Документы",
  description: "Все юридические, информационные и платежные документы сайта Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/documents") },
};

export default function DocumentsPage() {
  return <LegalDocumentsHub canonicalPath="/documents" />;
}
