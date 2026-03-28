// Next.js page for route /rent/[slug].
import { notFound, redirect } from "next/navigation";
import { getPublicPropertyByIdentifier } from "@/lib/public-properties";

type RentCardPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function RentCardPage({ params }: RentCardPageProps) {
  const { slug } = await params;
  const item = await getPublicPropertyByIdentifier(slug);

  if (!item) {
    notFound();
  }

  redirect(item.path);
}
