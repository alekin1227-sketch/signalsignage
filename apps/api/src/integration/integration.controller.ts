import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';
import { IntegrationService } from './integration.service';

@Controller('integrations') @UseGuards(JwtAuthGuard, RolesGuard)
export class IntegrationController {
  constructor(private readonly integrations: IntegrationService) {}

  @Get() list() { return this.integrations.list(); }
  @Get('summary') summary() { return this.integrations.summary(); }
  @Post() @Roles(UserRole.ADMIN) create(@Body() dto: CreateIntegrationDto) { return this.integrations.create(dto); }
  @Patch(':id') @Roles(UserRole.ADMIN) update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto) { return this.integrations.update(id, dto); }
  @Post(':id/test') @Roles(UserRole.ADMIN, UserRole.EDITOR) test(@Param('id') id: string) { return this.integrations.test(id); }
  @Delete(':id') @Roles(UserRole.ADMIN) remove(@Param('id') id: string) { return this.integrations.remove(id); }
}
