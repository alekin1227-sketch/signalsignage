import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePlayerAccessDto {
  @IsString() @MinLength(2) @MaxLength(80) label!: string;
  @IsString() @MinLength(3) @MaxLength(60) username!: string;
  @IsString() @MinLength(8) @MaxLength(120) password!: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) deviceLimit?: number;
}

export class UpdatePlayerAccessDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) label?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(60) username?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(120) password?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(100) deviceLimit?: number;
}
