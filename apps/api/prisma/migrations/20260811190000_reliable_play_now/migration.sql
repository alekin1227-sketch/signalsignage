ALTER TABLE "Device"
  ADD COLUMN "forcedPlaylistId" TEXT,
  ADD COLUMN "forcedCommandId" TEXT,
  ADD COLUMN "forcedAt" TIMESTAMP(3);

CREATE INDEX "Device_forcedPlaylistId_idx" ON "Device"("forcedPlaylistId");

ALTER TABLE "Device" ADD CONSTRAINT "Device_forcedPlaylistId_fkey"
  FOREIGN KEY ("forcedPlaylistId") REFERENCES "Playlist"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
