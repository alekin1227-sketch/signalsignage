ALTER TYPE "MediaType" ADD VALUE 'WIDGET';

CREATE TYPE "WidgetTemplate" AS ENUM ('WEATHER', 'KPI', 'KPI_GRID', 'MARKET_TICKER', 'TABLE', 'LIST');

CREATE TABLE "DataWidget" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "template" "WidgetTemplate" NOT NULL,
    "refreshSeconds" INTEGER NOT NULL DEFAULT 300,
    "mapping" JSONB NOT NULL,
    "style" JSONB,
    "authHeaderName" TEXT,
    "authEnvVar" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataWidget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataWidget_mediaId_key" ON "DataWidget"("mediaId");
CREATE INDEX "DataWidget_enabled_idx" ON "DataWidget"("enabled");
ALTER TABLE "DataWidget" ADD CONSTRAINT "DataWidget_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
