// Next.js page for route /dashboard/objects/[id]/payment.
import { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { PropertyPaymentPanel } from "@/components/payments/property-payment-panel";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getPlacementCoverageState,
  getTariffQuote,
  serializePayment,
} from "@/lib/payments";
import { getPropertyPaymentReadinessIssues, getPropertyProgress } from "@/lib/properties";

type PaymentPageProps = {
  params: Promise<{ id: string }>;
};

const paymentReadinessInclude = Prisma.validator<Prisma.PropertyInclude>()({
  media: {
    where: { roomId: null },
    select: {
      id: true,
      type: true,
      url: true,
      sortOrder: true,
    },
  },
  rooms: {
    where: { isActive: true },
    select: {
      id: true,
      prices: {
        select: { id: true },
      },
    },
  },
  amenities: {
    include: { amenity: true },
  },
  customAmenities: {
    select: { name: true },
  },
});

export default async function DashboardObjectPaymentPage({ params }: PaymentPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/objects");
  }

  const { id } = await params;

  const [property, payments] = await Promise.all([
    db.property.findUnique({
      where: { id },
      include: paymentReadinessInclude,
    }),
    db.payment.findMany({
      where: {
        propertyId: id,
        ownerId: session.id,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        property: {
          select: { name: true },
        },
      },
    }),
  ]);

  if (!property || property.ownerId !== session.id || property.ownerDeletedAt) {
    notFound();
  }

  const progress = getPropertyProgress(property);
  const roomCount = property.rooms.length;
  const readinessIssues = getPropertyPaymentReadinessIssues(property.id, progress);
  const readinessReasons = readinessIssues.map((issue) => issue.reason);
  const quote =
    roomCount > 0
      ? getTariffQuote({
          roomCount,
          propertyType: property.type,
        })
      : null;
  const initialPlacement = getPlacementCoverageState({
    payments,
    quote,
  });

  return (
    <div className="space-y-5">
      <ObjectSectionNav propertyId={property.id} activeSection="payment" />
      <div className="min-w-0">
        <PropertyPaymentPanel
          propertyId={property.id}
          propertyName={property.name ?? "Объект без названия"}
          initialPropertyStatus={property.status}
          initialPendingEditStatus={property.pendingEditStatus}
          initialModerationNotes={property.moderationNotes}
          initialReadiness={{
            ready: readinessIssues.length === 0,
            reasons: readinessReasons,
            issues: readinessIssues,
            progressStep: progress.lastCompletedStep,
            roomCount,
            quote,
          }}
          initialPlacement={initialPlacement}
          initialPayments={payments.map(serializePayment)}
        />
      </div>
    </div>
  );
}
