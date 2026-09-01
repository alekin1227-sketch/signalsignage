CREATE TYPE "IntegrationType" AS ENUM ('POWER_BI', 'REST_API', 'PROTHEUS', 'WEBHOOK');
CREATE TYPE "IntegrationAuthType" AS ENUM ('NONE', 'BEARER', 'API_KEY', 'BASIC');
CREATE TYPE "IntegrationStatus" AS ENUM ('UNTESTED', 'ONLINE', 'DEGRADED', 'OFFLINE');

CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "IntegrationType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authType" "IntegrationAuthType" NOT NULL DEFAULT 'NONE',
    "authHeaderName" TEXT,
    "authEnvVar" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" "IntegrationStatus" NOT NULL DEFAULT 'UNTESTED',
    "lastLatencyMs" INTEGER,
    "lastTestAt" TIMESTAMP(3),
    "lastMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Integration_type_enabled_idx" ON "Integration"("type", "enabled");
CREATE INDEX "Integration_lastStatus_idx" ON "Integration"("lastStatus");
