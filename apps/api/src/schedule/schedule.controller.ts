import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { UserRole } from '@prisma/client';
import { CreateScheduleDto } from './dto';
import { ScheduleService } from './schedule.service';
@UseGuards(JwtAuthGuard, RolesGuard) @Controller('schedules')
export class ScheduleController {
  constructor(private schedules: ScheduleService) {}
  @Get() list() { return this.schedules.list(); }
  @Post() @Roles(UserRole.ADMIN, UserRole.EDITOR) create(@Body() dto: CreateScheduleDto) { return this.schedules.create(dto); }
  @Patch(':id') @Roles(UserRole.ADMIN, UserRole.EDITOR) update(@Param('id') id: string, @Body() dto: Partial<CreateScheduleDto>) { return this.schedules.update(id, dto); }
  @Delete(':id') @Roles(UserRole.ADMIN, UserRole.EDITOR) remove(@Param('id') id: string) { return this.schedules.remove(id); }
}
