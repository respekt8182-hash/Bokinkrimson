import { ObjectPaymentStatus, ObjectTariffType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getObjectPaymentDisplay } from "@/lib/object-placement-status";
import { resolvePropertyPaymentStatus } from "@/lib/properties";

describe("object placement status", () => {
  it("marks ended property placement as unpaid", () => {
    const now = new Date("2027-05-02T09:00:00.000Z");
    const paidUntil = new Date("2027-05-01T09:00:00.000Z");

    expect(
      resolvePropertyPaymentStatus({
        paymentStatus: ObjectPaymentStatus.PAID,
        tariffType: ObjectTariffType.YEARLY,
        paidUntil,
        now,
      }),
    ).toBe(ObjectPaymentStatus.UNPAID);

    const display = getObjectPaymentDisplay({
      paymentStatus: ObjectPaymentStatus.PAID,
      tariffType: ObjectTariffType.YEARLY,
      paidUntil,
      now,
    });

    expect(display.status).toBe("unpaid");
    expect(display.label).toBe("Не оплачено");
    expect(display.paidUntil).toBe(paidUntil);
  });
});
