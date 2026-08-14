CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED');
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'URL');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'EDITOR', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Device" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "hardwareId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE', "resolution" TEXT, "ipAddress" TEXT, "appVersion" TEXT,
  "lastSeenAt" TIMESTAMP(3), "lastQueuePullAt" TIMESTAMP(3), "nowPlayingId" TEXT, "nowPlayingName" TEXT,
  "nowPlayingAt" TIMESTAMP(3), "screenshotUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Media" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "type" "MediaType" NOT NULL, "fileName" TEXT, "originalName" TEXT,
  "mimeType" TEXT, "sizeBytes" BIGINT, "url" TEXT, "thumbnailUrl" TEXT, "durationSec" INTEGER, "checksum" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Playlist" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlaylistItem" (
  "id" TEXT NOT NULL, "playlistId" TEXT NOT NULL, "mediaId" TEXT NOT NULL, "position" INTEGER NOT NULL,
  "durationSec" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Schedule" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "playlistId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3), "daysOfWeek" INTEGER[], "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL, "priority" INTEGER NOT NULL DEFAULT 0, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Device_hardwareId_key" ON "Device"("hardwareId");
CREATE UNIQUE INDEX "Device_tokenHash_key" ON "Device"("tokenHash");
CREATE INDEX "Device_lastSeenAt_idx" ON "Device"("lastSeenAt");
CREATE UNIQUE INDEX "PlaylistItem_playlistId_position_key" ON "PlaylistItem"("playlistId", "position");
CREATE INDEX "PlaylistItem_playlistId_idx" ON "PlaylistItem"("playlistId");
CREATE INDEX "Schedule_deviceId_enabled_idx" ON "Schedule"("deviceId", "enabled");
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
