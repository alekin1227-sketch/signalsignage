import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { CreateUserDto, UpdateUserDto } from './dto';
import { UsersService } from './users.service';

@Controller('users') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private users: UsersService) {}
  @Get() list() { return this.users.list(); }
  @Post() create(@Body() dto: CreateUserDto) { return this.users.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto) { return this.users.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: Request & { user: { id: string } }) {
    if (req.user.id === id) throw new BadRequestException('Você não pode excluir o próprio usuário');
    return this.users.remove(id);
  }
}
