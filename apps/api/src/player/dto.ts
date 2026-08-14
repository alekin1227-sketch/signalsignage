import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class RegisterDeviceDto {
  @IsString() hardwareId!: string;
  @IsString() name!: string;
  @IsOptional() @Matches(/^\d+x\d+$/) resolution?: string;
  @IsOptional() @IsString() appVersion?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(60) accessUsername?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(120) accessPassword?: string;
}
export class HeartbeatDto {
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsString() nowPlayingId?: string;
  @IsOptional() @IsString() nowPlayingName?: string;
}
