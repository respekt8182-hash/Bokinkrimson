-- AlterTable
ALTER TABLE "RoomPrice" ADD COLUMN "minGuests" INTEGER;

-- CreateTable
CREATE TABLE "RoomOccupancy" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "guestContacts" TEXT,
    "description" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomOccupancy_roomId_dateFrom_dateTo_idx" ON "RoomOccupancy"("roomId", "dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "RoomOccupancy_roomId_createdAt_idx" ON "RoomOccupancy"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoomOccupancy" ADD CONSTRAINT "RoomOccupancy_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;