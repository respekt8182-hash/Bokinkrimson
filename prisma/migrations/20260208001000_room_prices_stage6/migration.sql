-- CreateTable
CREATE TABLE "RoomPrice" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomPrice_roomId_dateFrom_dateTo_idx" ON "RoomPrice"("roomId", "dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "RoomPrice_roomId_createdAt_idx" ON "RoomPrice"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoomPrice" ADD CONSTRAINT "RoomPrice_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
