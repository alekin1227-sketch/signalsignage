import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
export class CreateScheduleDto {
  @IsString() name!: string;
  @IsString() deviceId!: string;
  @IsString() playlistId!: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) daysOfWeek!: number[];
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
