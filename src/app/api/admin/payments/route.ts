// Admin API: list manager payment requests.
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { buildOffsetPagination, parsePagination } from "@/lib/pagination";
import { getTransferPaymentReference } from "@/lib/payments";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const statusFilter = searchParams.get("status") ?? "PENDING";
  const providerFilter = searchParams.get("provider") ?? "MANAGER";
  const pagination = parsePagination({ request, defaultLimit: 25, maxLimit: 100 });
  const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", ["transferId"]);

  const whereStatus: PaymentStatus[] =
    statusFilter === "ALL"
      ? [
          PaymentStatus.CREATED,
          PaymentStatus.PENDING,
          PaymentStatus.SUCCEEDED,
          PaymentStatus.CANCELED,
        ]
      : statusFilter === "PENDING"
        ? [PaymentStatus.CREATED, PaymentStatus.PENDING]
        : [statusFilter as PaymentStatus];

  const whereProvider: PaymentProvider[] =
    providerFilter === "ALL"
      ? [PaymentProvider.YOOKASSA, PaymentProvider.MANAGER]
      : [providerFilter as PaymentProvider];

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where: {
        provider: { in: whereProvider },
        status: { in: whereStatus },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pagination.offset,
      take: pagination.limit,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            status: true,
            type: true,
          },
        },
        excursion: {
          select: {
            id: true,
            title: true,
            status: true,
          },
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    }),
    db.payment.count({
      where: {
        provider: { in: whereProvider },
        status: { in: whereStatus },
      },
    }),
  ]);

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

  return NextResponse.json({
    items: payments.map((p) => {
      const transfer = transferPaymentsSupported && "transfer" in p ? p.transfer : null;
      const transferReference = getTransferPaymentReference({
        transferId: p.transferId,
        tariffCode: p.tariffCode,
        providerPayload: p.providerPayload,
      });
      const referencedTransfer = transferReference
        ? transfersById.get(transferReference.transferId)
        : null;
      const resolvedTransfer = transfer ?? referencedTransfer ?? null;

      return {
        id: p.id,
        amount: Number(p.amount),
        tariffCode: p.tariffCode,
        roomCount: p.roomCount,
        status: p.status,
        provider: p.provider,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
        canceledAt: p.canceledAt?.toISOString() ?? null,
        managerNotes: p.managerNotes,
        confirmedById: p.confirmedById,
        property: p.property
          ? {
              id: p.property.id,
              name: p.property.name,
              status: p.property.status,
              type: p.property.type,
            }
          : null,
        excursion: p.excursion
          ? { id: p.excursion.id, title: p.excursion.title, status: p.excursion.status }
          : null,
        transfer: resolvedTransfer
          ? {
              id: resolvedTransfer.id,
              title: resolvedTransfer.title ?? transferReference?.transferTitle ?? null,
              status: resolvedTransfer.status,
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
    }),
    pagination: buildOffsetPagination(pagination, payments.length, total),
  });
}
