import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
export class UpdateDeviceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(['PENDING', 'ACTIVE', 'BLOCKED']) status?: 'PENDING' | 'ACTIVE' | 'BLOCKED';
}
export class PlayerControlDto {
  @IsIn(['PLAY', 'PAUSE', 'SEEK_FORWARD', 'SEEK_BACKWARD', 'NEXT', 'PREVIOUS'])
  action!: 'PLAY' | 'PAUSE' | 'SEEK_FORWARD' | 'SEEK_BACKWARD' | 'NEXT' | 'PREVIOUS';
  @IsOptional() @IsInt() @Min(1) @Max(300) seconds?: number;
}
