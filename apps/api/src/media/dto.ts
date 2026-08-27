import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { MediaType } from '@prisma/client';

export class CreateUrlMediaDto {
  @IsString() name!: string;
  @IsEnum(MediaType) type: MediaType = MediaType.URL;
  @IsUrl({ require_tld: false }) url!: string;
  @IsOptional() @IsUrl({ require_tld: false }) thumbnailUrl?: string;
}
export class UpdateMediaDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsUrl({ require_tld: false }) url?: string;
}
export class CreateFeedMediaDto {
  @IsString() name!: string;
  @IsUrl({ require_tld: false }) url!: string;
  @IsOptional() @IsInt() @Min(30) @Max(86400) refreshSeconds?: number;
}

export class ImportInboxMediaDto {
  @IsString() fileName!: string;
  @IsOptional() @IsString() name?: string;
}

export class StartChunkedUploadDto {
  @IsString() originalName!: string;
  @IsString() mimeType!: string;
  @IsInt() @Min(1) @Max(2 * 1024 * 1024 * 1024) sizeBytes!: number;
  @IsInt() @Min(1) @Max(10000) totalParts!: number;
  @IsOptional() @IsString() name?: string;
}

export class UploadChunkQueryDto {
  @IsInt() @Min(0) @Max(9999) partNumber!: number;
  @IsInt() @Min(1) @Max(10000) totalParts!: number;
}
