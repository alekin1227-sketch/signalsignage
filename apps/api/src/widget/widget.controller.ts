import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { AnalyzeWidgetDto, UpdateWidgetDto, WidgetConfigDto } from './dto';
import { WidgetService } from './widget.service';

@Controller('widgets')
export class WidgetController {
  constructor(private readonly widgets: WidgetService) {}

  @Get() @UseGuards(JwtAuthGuard, RolesGuard)
  list() { return this.widgets.list(); }

  @Post('preview') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR)
  preview(@Body() dto: WidgetConfigDto) { return this.widgets.preview(dto); }

  @Post('analyze') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR)
  analyze(@Body() dto: AnalyzeWidgetDto) { return this.widgets.analyze(dto); }

  @Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR)
  create(@Body() dto: WidgetConfigDto) { return this.widgets.create(dto); }

  @Patch(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR)
  update(@Param('id') id: string, @Body() dto: UpdateWidgetDto) { return this.widgets.update(id, dto); }

  @Delete(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR)
  remove(@Param('id') id: string) { return this.widgets.remove(id); }

  @Get(':id/data')
  data(@Param('id') id: string) { return this.widgets.data(id); }
}
