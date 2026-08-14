import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';

const select = { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true };

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  list() { return this.prisma.user.findMany({ select, orderBy: { name: 'asc' } }); }
  async create(dto: CreateUserDto) {
    try { return await this.prisma.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), role: dto.role, passwordHash: await bcrypt.hash(dto.password, 12) }, select }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new BadRequestException('Este e-mail já está cadastrado'); throw error; }
  }
  async update(id: string, dto: UpdateUserDto) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (current.role === UserRole.ADMIN && dto.role && dto.role !== UserRole.ADMIN && await this.prisma.user.count({ where: { role: UserRole.ADMIN } }) <= 1) throw new BadRequestException('Não é possível remover o último administrador');
    const { password, ...data } = dto;
    try { return await this.prisma.user.update({ where: { id }, data: { ...data, email: data.email?.trim().toLowerCase(), passwordHash: password ? await bcrypt.hash(password, 12) : undefined }, select }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new BadRequestException('Este e-mail já está cadastrado'); throw error; }
  }
  async remove(id: string) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (current.role === UserRole.ADMIN && await this.prisma.user.count({ where: { role: UserRole.ADMIN } }) <= 1) throw new BadRequestException('Não é possível excluir o último administrador');
    await this.prisma.user.delete({ where: { id } }); return { deleted: true };
  }
}
