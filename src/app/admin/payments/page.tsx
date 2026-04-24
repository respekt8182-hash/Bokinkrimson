// Admin page for managing manager payment requests.
import { PaymentProvider } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ManagerPaymentsList } from "@/components/admin/manager-payments-list";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const payments = await db.payment.findMany({
    where: {
      provider: PaymentProvider.MANAGER,
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      property: {
        select: { id: true, name: true, status: true, type: true },
      },
      excursion: {
        select: { id: true, title: true, status: true },
      },
      owner: {
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      },
    },
  });

  const serialized = payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    tariffCode: p.tariffCode,
    roomCount: p.roomCount,
    status: p.status as string,
    provider: p.provider as string,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
    canceledAt: p.canceledAt?.toISOString() ?? null,
    managerNotes: p.managerNotes,
    confirmedById: p.confirmedById,
    property: p.property
      ? { id: p.property.id, name: p.property.name, status: p.property.status as string, type: p.property.type }
      : null,
    excursion: p.excursion
      ? { id: p.excursion.id, title: p.excursion.title, status: p.excursion.status as string }
      : null,
    owner: {
      id: p.owner.id,
      firstName: p.owner.firstName,
      lastName: p.owner.lastName,
      phone: p.owner.phone,
      email: p.owner.email,
    },
  }));

  const pending = serialized.filter(
    (p) => p.status === "CREATED" || p.status === "PENDING",
  );
  const completed = serialized.filter(
    (p) => p.status === "SUCCEEDED" || p.status === "CANCELED",
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Оплата"
        description="Заявки на оплату через менеджера и история решений."
      />

      <ManagerPaymentsList
        pendingPayments={pending}
        completedPayments={completed}
      />
    </div>
  );
}
