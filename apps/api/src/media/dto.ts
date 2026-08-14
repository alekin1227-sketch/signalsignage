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
