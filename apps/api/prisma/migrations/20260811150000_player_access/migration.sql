CREATE TABLE "PlayerAccess" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "deviceLimit" INTEGER NOT NULL DEFAULT 1,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerAccess_username_key" ON "PlayerAccess"("username");

ALTER TABLE "Device" ADD COLUMN "playerAccessId" TEXT;
CREATE INDEX "Device_playerAccessId_idx" ON "Device"("playerAccessId");
ALTER TABLE "Device" ADD CONSTRAINT "Device_playerAccessId_fkey"
  FOREIGN KEY ("playerAccessId") REFERENCES "PlayerAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
