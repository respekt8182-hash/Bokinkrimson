// Admin page for managing manager payment requests.
import { PaymentProvider } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { getAdminSession } from "@/lib/admin-auth";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import {
  getTransferPaymentPayload,
  getTransferPaymentReference,
  shouldCountPaymentInAdminRevenue,
} from "@/lib/payments";
import { ManagerPaymentsList } from "@/components/admin/manager-payments-list";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", ["transferId"]);
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
      ...(transferPaymentsSupported
        ? {
            transfer: {
              select: {
                id: true,
                title: true,
                status: true,
                transferType: true,
                locationName: true,
                vehicleModel: true,
              },
            },
          }
        : {}),
      owner: {
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      },
    },
  });

  const transferReferences = payments.flatMap((payment) => {
    const reference = getTransferPaymentReference({
      transferId: payment.transferId,
      tariffCode: payment.tariffCode,
      providerPayload: payment.providerPayload,
    });

    return reference ? [reference] : [];
  });
  const transferIds = Array.from(
    new Set(transferReferences.map((reference) => reference.transferId)),
  );
  const transferRows =
    transferIds.length > 0
      ? await db.transfer.findMany({
          where: { id: { in: transferIds } },
          select: {
            id: true,
            title: true,
            status: true,
            transferType: true,
            locationName: true,
            vehicleModel: true,
          },
        })
      : [];
  const transfersById = new Map(transferRows.map((transfer) => [transfer.id, transfer]));

  const serialized = payments.map((p) => {
    const transfer = transferPaymentsSupported && "transfer" in p ? p.transfer : null;
    const transferReference = getTransferPaymentReference({
      transferId: p.transferId,
      tariffCode: p.tariffCode,
      providerPayload: p.providerPayload,
    });
    const transferPayload = getTransferPaymentPayload(p.providerPayload);
    const referencedTransfer = transferReference
      ? transfersById.get(transferReference.transferId)
      : null;
    const resolvedTransfer = transfer ?? referencedTransfer ?? null;

    return {
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
      includeInMonthlyRevenue: shouldCountPaymentInAdminRevenue(p.providerPayload),
      transferPayment: transferPayload
        ? {
            paymentReason: transferPayload.paymentReason ?? null,
            vehicleCount: transferPayload.vehicleCount ?? null,
            totalAmountRub: transferPayload.totalAmountRub ?? null,
            coveredAmountRub: transferPayload.coveredAmountRub ?? null,
            requiredAmountRub: transferPayload.requiredAmountRub ?? null,
          }
        : null,
      property: p.property
        ? {
            id: p.property.id,
            name: p.property.name,
            status: p.property.status as string,
            type: p.property.type,
          }
        : null,
      excursion: p.excursion
        ? { id: p.excursion.id, title: p.excursion.title, status: p.excursion.status as string }
        : null,
      transfer: resolvedTransfer
        ? {
            id: resolvedTransfer.id,
            title: resolvedTransfer.title ?? transferReference?.transferTitle ?? null,
            status: resolvedTransfer.status as string,
            transferType: resolvedTransfer.transferType,
            locationName: resolvedTransfer.locationName,
            vehicleModel: resolvedTransfer.vehicleModel,
          }
        : transferReference
          ? {
              id: transferReference.transferId,
              title: transferReference.transferTitle,
              status: null,
              transferType: null,
              locationName: null,
              vehicleModel: null,
            }
          : null,
      owner: {
        id: p.owner.id,
        firstName: p.owner.firstName,
        lastName: p.owner.lastName,
        phone: p.owner.phone,
        email: p.owner.email,
      },
    };
  });

  const pending = serialized.filter((p) => p.status === "CREATED" || p.status === "PENDING");
  const completed = serialized.filter((p) => p.status === "SUCCEEDED" || p.status === "CANCELED");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Оплата"
        description="Заявки на оплату через менеджера и история решений."
      />

      <ManagerPaymentsList pendingPayments={pending} completedPayments={completed} />
    </div>
  );
}
