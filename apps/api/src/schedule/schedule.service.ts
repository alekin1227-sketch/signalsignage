import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto';
@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService) {}
  list() { return this.prisma.schedule.findMany({ include: { device: true, playlist: true }, orderBy: { priority: 'desc' } }); }
  create(dto: CreateScheduleDto) { return this.prisma.schedule.create({ data: {
    ...dto, startDate: dto.startDate ? new Date(dto.startDate) : null, endDate: dto.endDate ? new Date(dto.endDate) : null,
  }}); }
  update(id: string, dto: Partial<CreateScheduleDto>) { return this.prisma.schedule.update({ where: { id }, data: { ...dto, startDate: dto.startDate ? new Date(dto.startDate) : undefined, endDate: dto.endDate ? new Date(dto.endDate) : undefined } }); }
  async remove(id: string) { await this.prisma.schedule.delete({ where: { id } }); return { deleted: true }; }
}
