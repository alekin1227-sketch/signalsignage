import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaylistDto, ReorderPlaylistDto } from './dto';

const include = { items: { orderBy: { position: 'asc' as const }, include: { media: true } } };
@Injectable()
export class PlaylistService {
  constructor(private prisma: PrismaService) {}
  list() { return this.prisma.playlist.findMany({ include, orderBy: { updatedAt: 'desc' } }); }
  async get(id: string) { const value = await this.prisma.playlist.findUnique({ where: { id }, include }); if (!value) throw new NotFoundException('Playlist não encontrada'); return value; }
  async create(dto: CreatePlaylistDto) {
    return this.prisma.playlist.create({ data: {
      name: dto.name, description: dto.description, isActive: dto.isActive, loop: dto.loop ?? true,
      items: { create: dto.items.map((item, position) => ({ ...item, position })) },
    }, include });
  }
  async reorder(id: string, dto: ReorderPlaylistDto) {
    if (!(await this.prisma.playlist.findUnique({ where: { id } }))) throw new NotFoundException('Playlist não encontrada');
    return this.prisma.$transaction(async tx => {
      await tx.playlistItem.deleteMany({ where: { playlistId: id } });
      await tx.playlistItem.createMany({ data: dto.items.map((item, position) => ({ playlistId: id, mediaId: item.mediaId, durationSec: item.durationSec, useMediaDuration: item.useMediaDuration ?? false, position })) });
      return tx.playlist.update({ where: { id }, data: { updatedAt: new Date() }, include });
    });
  }
  update(id: string, dto: { name?: string; description?: string; isActive?: boolean; loop?: boolean }) { return this.prisma.playlist.update({ where: { id }, data: dto, include }); }
  async remove(id: string) { await this.prisma.playlist.delete({ where: { id } }); return { deleted: true }; }
}
