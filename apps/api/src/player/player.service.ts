import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { tokenHash } from './device-token.guard';
import { HeartbeatDto, RegisterDeviceDto } from './dto';

@Injectable()
export class PlayerService {
  constructor(private prisma: PrismaService) {}
  async register(dto: RegisterDeviceDto, enrollmentKey: string | undefined, ipAddress?: string) {
    const byHardware = await this.prisma.device.findUnique({ where: { hardwareId: dto.hardwareId } });
    const sameName = await this.prisma.device.findMany({ where: { name: { equals: dto.name.trim(), mode: 'insensitive' } }, orderBy: { updatedAt: 'desc' } });
    const existing = byHardware ?? sameName[0];
    if (existing?.status === 'BLOCKED') throw new ForbiddenException('Este dispositivo está bloqueado pelo administrador');
    const duplicateIds = sameName.filter(device => device.id !== existing?.id).map(device => device.id);
    const validEnrollmentKey = !!process.env.ENROLLMENT_KEY && enrollmentKey === process.env.ENROLLMENT_KEY;
    let playerAccess: { id: string; passwordHash: string; enabled: boolean; deviceLimit: number } | null = null;
    if (!validEnrollmentKey) {
      if (!dto.accessUsername || !dto.accessPassword) throw new ForbiddenException('Informe o usuário e a senha do Player');
      playerAccess = await this.prisma.playerAccess.findUnique({
        where: { username: dto.accessUsername.trim().toLowerCase() },
        select: { id: true, passwordHash: true, enabled: true, deviceLimit: true },
      });
      if (!playerAccess || !playerAccess.enabled || !(await bcrypt.compare(dto.accessPassword, playerAccess.passwordHash))) {
        throw new ForbiddenException('Usuário ou senha do Player inválidos');
      }
      const devicesInUse = await this.prisma.device.count({ where: {
        playerAccessId: playerAccess.id,
        id: { notIn: [existing?.id, ...duplicateIds].filter((id): id is string => !!id) },
      } });
      if (devicesInUse >= playerAccess.deviceLimit) throw new ForbiddenException('Este acesso atingiu o limite de TVs permitido');
    }
    const token = randomBytes(32).toString('base64url');
    const data = {
      name: dto.name.trim(), hardwareId: dto.hardwareId, resolution: dto.resolution,
      appVersion: dto.appVersion, ipAddress, tokenHash: tokenHash(token), status: 'ACTIVE' as const,
      playerAccessId: playerAccess?.id ?? existing?.playerAccessId ?? null,
    };
    const device = await this.prisma.$transaction(async tx => {
      const saved = existing
        ? await tx.device.update({ where: { id: existing.id }, data })
        : await tx.device.create({ data });
      if (duplicateIds.length) {
        await tx.schedule.updateMany({ where: { deviceId: { in: duplicateIds } }, data: { deviceId: saved.id } });
        await tx.device.deleteMany({ where: { id: { in: duplicateIds } } });
      }
      if (playerAccess) await tx.playerAccess.update({ where: { id: playerAccess.id }, data: { lastUsedAt: new Date() } });
      return saved;
    });
    return { deviceId: device.id, deviceToken: token };
  }

  async heartbeat(deviceId: string, dto: HeartbeatDto, ipAddress?: string) {
    return this.prisma.device.update({ where: { id: deviceId }, data: {
      lastSeenAt: new Date(), resolution: dto.resolution, ipAddress,
      nowPlayingId: dto.nowPlayingId, nowPlayingName: dto.nowPlayingName,
      nowPlayingAt: dto.nowPlayingId ? new Date() : undefined,
    }});
  }

  private scheduleIsActive(schedule: any, now: Date) {
    if (schedule.startDate && now < schedule.startDate) return false;
    if (schedule.endDate && now > schedule.endDate) return false;
    if (!schedule.daysOfWeek.includes(now.getDay())) return false;
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return schedule.startTime <= schedule.endTime
      ? time >= schedule.startTime && time < schedule.endTime
      : time >= schedule.startTime || time < schedule.endTime;
  }

  async queue(deviceId: string, playlistId?: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId }, select: {
      forcedPlaylistId: true, forcedCommandId: true,
    }});
    if (!device) throw new NotFoundException('Dispositivo não encontrado');
    let selected: any;
    if (playlistId) selected = await this.prisma.playlist.findFirst({ where: { id: playlistId, isActive: true } });
    else if (device.forcedPlaylistId) selected = await this.prisma.playlist.findFirst({ where: { id: device.forcedPlaylistId, isActive: true } });
    else {
      const schedules = await this.prisma.schedule.findMany({ where: { deviceId, enabled: true }, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] });
      const active = schedules.find(s => this.scheduleIsActive(s, new Date()));
      if (active) selected = await this.prisma.playlist.findUnique({ where: { id: active.playlistId } });
    }
    await this.prisma.device.update({ where: { id: deviceId }, data: { lastSeenAt: new Date(), lastQueuePullAt: new Date() } });
    if (!selected) return { version: 'empty', playlist: null, items: [], generatedAt: new Date() };
    const items = await this.prisma.playlistItem.findMany({ where: { playlistId: selected.id }, orderBy: { position: 'asc' }, include: { media: { include: { dataWidget: true } } } });
    const configuredBase = (process.env.PUBLIC_API_URL ?? 'http://localhost:3000').trim();
    const base = (/^https?:\/\//i.test(configuredBase) ? configuredBase : `http://${configuredBase.replace(/^\/+/, '')}`).replace(/\/$/, '');
    const payload = items.map(i => ({
      id: i.id, mediaId: i.mediaId, name: i.media.name, type: i.media.type, durationSec: i.durationSec,
      useMediaDuration: i.media.type === 'VIDEO' && i.useMediaDuration,
      mediaDurationSec: i.media.durationSec,
      url: i.media.type === 'URL' ? i.media.url
        : i.media.type === 'FEED' ? `${base}/api/media/feed/${i.mediaId}`
          : i.media.type === 'WIDGET' && i.media.dataWidget ? `${base}/api/widgets/${i.media.dataWidget.id}/data`
            : `${base}/api/media/stream/${i.mediaId}`,
      checksum: i.media.checksum, mimeType: i.media.mimeType, position: i.position,
    }));
    const forced = device.forcedPlaylistId === selected.id;
    const version = createHash('sha256').update(JSON.stringify({
      playlistId: selected.id, loop: selected.loop, payload,
      forcedCommandId: forced ? device.forcedCommandId : null,
    })).digest('hex').slice(0, 16);
    return {
      version,
      playlist: { id: selected.id, name: selected.name, loop: selected.loop, forced },
      items: payload,
      generatedAt: new Date(),
    };
  }
}
