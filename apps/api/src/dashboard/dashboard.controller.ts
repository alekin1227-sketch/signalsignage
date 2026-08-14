import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard) @Controller('dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}
  @Get('stats') async stats() {
    const threshold = new Date(Date.now() - 90_000);
    const [media, devices, online, schedules, image, video, pdf, url, feed, widget] = await Promise.all([
      this.prisma.media.count(), this.prisma.device.count(), this.prisma.device.count({ where: { lastSeenAt: { gte: threshold }, status: 'ACTIVE' } }),
      this.prisma.schedule.count({ where: { enabled: true } }), this.prisma.media.count({ where: { type: 'IMAGE' } }),
      this.prisma.media.count({ where: { type: 'VIDEO' } }), this.prisma.media.count({ where: { type: 'PDF' } }),
      this.prisma.media.count({ where: { type: 'URL' } }),
      this.prisma.media.count({ where: { type: 'FEED' } }),
      this.prisma.media.count({ where: { type: 'WIDGET' } }),
    ]);
    return { media, devices, online, schedules, mediaByType: { image, video, pdf, url, feed, widget } };
  }
}
