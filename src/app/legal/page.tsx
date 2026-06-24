import type { Metadata } from "next";
import { LegalDocumentsHub } from "@/components/legal/legal-documents-hub";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Юридическая информация",
  description: "Юридические документы и реквизиты сайта Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal") },
};

export default function LegalIndexPage() {
  return <LegalDocumentsHub canonicalPath="/legal" />;
}
