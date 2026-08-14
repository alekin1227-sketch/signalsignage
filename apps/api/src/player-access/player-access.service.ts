import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlayerAccessDto, UpdatePlayerAccessDto } from './dto';

const select = {
  id: true, label: true, username: true, enabled: true, deviceLimit: true,
  lastUsedAt: true, createdAt: true, updatedAt: true,
  devices: { select: { id: true, name: true, status: true, lastSeenAt: true } },
};

@Injectable()
export class PlayerAccessService {
  constructor(private prisma: PrismaService) {}
  list() { return this.prisma.playerAccess.findMany({ select, orderBy: { createdAt: 'desc' } }); }
  async create(dto: CreatePlayerAccessDto) {
    try {
      return await this.prisma.playerAccess.create({ data: {
        label: dto.label.trim(), username: dto.username.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(dto.password, 12), deviceLimit: dto.deviceLimit ?? 1,
      }, select });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new BadRequestException('Este usuário do Player já existe');
      throw error;
    }
  }
  async update(id: string, dto: UpdatePlayerAccessDto) {
    const { password, ...data } = dto;
    try {
      return await this.prisma.playerAccess.update({ where: { id }, data: {
        ...data, label: data.label?.trim(), username: data.username?.trim().toLowerCase(),
        passwordHash: password ? await bcrypt.hash(password, 12) : undefined,
      }, select });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new BadRequestException('Este usuário do Player já existe');
      throw error;
    }
  }
  async remove(id: string) {
    await this.prisma.playerAccess.delete({ where: { id } });
    return { deleted: true };
  }
}
