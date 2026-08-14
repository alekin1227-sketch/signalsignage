import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class PlaylistItemDto {
  @IsString() mediaId!: string;
  @IsInt() @Min(1) durationSec!: number;
  @IsOptional() @IsBoolean() useMediaDuration?: boolean;
}
export class CreatePlaylistDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() loop?: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PlaylistItemDto) items!: PlaylistItemDto[];
}
export class ReorderPlaylistDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => PlaylistItemDto) items!: PlaylistItemDto[];
}
