import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { CreatePlayerAccessDto, UpdatePlayerAccessDto } from './dto';
import { PlayerAccessService } from './player-access.service';

@Controller('player-access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PlayerAccessController {
  constructor(private accesses: PlayerAccessService) {}
  @Get() list() { return this.accesses.list(); }
  @Post() create(@Body() dto: CreatePlayerAccessDto) { return this.accesses.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdatePlayerAccessDto) { return this.accesses.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.accesses.remove(id); }
}
