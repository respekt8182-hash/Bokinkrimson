-- CreateTable
CREATE TABLE "FavoriteProperty" (
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteProperty_pkey" PRIMARY KEY ("userId","propertyId")
);

-- CreateIndex
CREATE INDEX "FavoriteProperty_propertyId_createdAt_idx" ON "FavoriteProperty"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "FavoriteProperty_userId_createdAt_idx" ON "FavoriteProperty"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "FavoriteProperty" ADD CONSTRAINT "FavoriteProperty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteProperty" ADD CONSTRAINT "FavoriteProperty_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
