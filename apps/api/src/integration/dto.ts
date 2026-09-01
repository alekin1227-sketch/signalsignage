import { IntegrationAuthType, IntegrationType } from '@prisma/client';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

export class CreateIntegrationDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsEnum(IntegrationType) type!: IntegrationType;
  @IsUrl({ require_tld: false }) baseUrl!: string;
  @IsOptional() @IsEnum(IntegrationAuthType) authType?: IntegrationAuthType;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9-]{1,64}$/) authHeaderName?: string;
  @IsOptional() @IsString() @Matches(/^INTEGRATION_SECRET_[A-Z0-9_]+$/) authEnvVar?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateIntegrationDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsEnum(IntegrationType) type?: IntegrationType;
  @IsOptional() @IsUrl({ require_tld: false }) baseUrl?: string;
  @IsOptional() @IsEnum(IntegrationAuthType) authType?: IntegrationAuthType;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9-]{1,64}$/) authHeaderName?: string;
  @IsOptional() @IsString() @Matches(/^INTEGRATION_SECRET_[A-Z0-9_]+$/) authEnvVar?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
