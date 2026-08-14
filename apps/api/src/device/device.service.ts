import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}
  list() { return this.prisma.device.findMany({
    include: {
      playerAccess: { select: { id: true, label: true, username: true } },
      forcedPlaylist: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  }); }
  update(id: string, data: { name?: string; status?: any }) { return this.prisma.device.update({ where: { id }, data }); }
  async playNow(id: string, playlistId: string) {
    const [device, playlist, itemCount] = await Promise.all([
      this.prisma.device.findUnique({ where: { id }, select: { id: true, status: true } }),
      this.prisma.playlist.findUnique({ where: { id: playlistId }, select: { id: true, name: true, isActive: true } }),
      this.prisma.playlistItem.count({ where: { playlistId } }),
    ]);
    if (!device) throw new NotFoundException('Dispositivo não encontrado');
    if (!playlist || !playlist.isActive) throw new NotFoundException('Playlist ativa não encontrada');
    if (!itemCount) throw new BadRequestException('A playlist está vazia');
    if (device.status !== 'ACTIVE') throw new BadRequestException('O dispositivo está bloqueado ou inativo');
    const commandId = randomUUID();
    await this.prisma.device.update({ where: { id }, data: {
      forcedPlaylistId: playlistId, forcedCommandId: commandId, forcedAt: new Date(),
    }});
    return { playlist, commandId };
  }
  async clearPlayNow(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id }, select: { id: true } });
    if (!device) throw new NotFoundException('Dispositivo não encontrado');
    await this.prisma.device.update({ where: { id }, data: {
      forcedPlaylistId: null, forcedCommandId: null, forcedAt: null,
    }});
  }
  async remove(id: string) { await this.prisma.device.delete({ where: { id } }); return { deleted: true }; }
}
