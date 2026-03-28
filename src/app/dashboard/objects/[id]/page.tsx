// Next.js page for route /dashboard/objects/[id].
import { redirect } from "next/navigation";

type DashboardObjectByIdPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DashboardObjectByIdPage({ params }: DashboardObjectByIdPageProps) {
  const { id } = await params;
  redirect(`/dashboard/objects/${id}/about`);
}
