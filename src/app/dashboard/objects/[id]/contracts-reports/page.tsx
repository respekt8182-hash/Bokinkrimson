// Next.js page for route /dashboard/objects/[id]/contracts-reports.
import { redirect } from "next/navigation";

type DashboardObjectContractsReportsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DashboardObjectContractsReportsPage({
  params,
}: DashboardObjectContractsReportsPageProps) {
  const { id } = await params;
  redirect(`/dashboard/objects/${id}/room-categories`);
}
