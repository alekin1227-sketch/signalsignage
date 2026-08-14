import { WidgetTemplate } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUrl, Matches, Max, Min } from 'class-validator';

export class WidgetConfigDto {
  @IsString() name!: string;
  @IsUrl({ require_tld: false }) endpoint!: string;
  @IsEnum(WidgetTemplate) template!: WidgetTemplate;
  @IsInt() @Min(30) @Max(86400) refreshSeconds = 300;
  @IsObject() mapping!: Record<string, unknown>;
  @IsOptional() @IsObject() style?: Record<string, unknown>;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9-]{1,64}$/) authHeaderName?: string;
  @IsOptional() @IsString() @Matches(/^WIDGET_SECRET_[A-Z0-9_]+$/) authEnvVar?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateWidgetDto extends WidgetConfigDto {}

export class AnalyzeWidgetDto {
  @IsString() name!: string;
  @IsUrl({ require_tld: false }) endpoint!: string;
  @IsOptional() @IsInt() @Min(30) @Max(86400) refreshSeconds = 300;
  @IsOptional() @IsObject() style?: Record<string, unknown>;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9-]{1,64}$/) authHeaderName?: string;
  @IsOptional() @IsString() @Matches(/^WIDGET_SECRET_[A-Z0-9_]+$/) authEnvVar?: string;
}
