import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TransferDetails } from "@/components/public/marketplace-catalogs";
import { getPublicTransferByIdentifier } from "@/lib/public-marketplace";
import { buildCanonicalPath } from "@/lib/seo/canonical";

type TransferDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: TransferDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicTransferByIdentifier(slug);

  if (!item) {
    return {
      title: "Трансфер не найден — Крым Вокруг",
    };
  }

  return {
    title: `${item.title} — трансферы по Крыму`,
    description:
      item.shortDescription ??
      item.description?.slice(0, 160) ??
      `Трансферная услуга ${item.title} в каталоге Крым Вокруг.`,
    alternates: {
      canonical: buildCanonicalPath(item.path),
    },
    openGraph: {
      title: item.title,
      description: item.shortDescription ?? item.description ?? undefined,
      images: item.coverImageUrl ? [item.coverImageUrl] : undefined,
    },
  };
}

export default async function TransferDetailPage({ params }: TransferDetailPageProps) {
  const { slug } = await params;
  const item = await getPublicTransferByIdentifier(slug);

  if (!item) {
    notFound();
  }

  return <TransferDetails item={item} />;
}
