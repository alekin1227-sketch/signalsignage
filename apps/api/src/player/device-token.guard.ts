import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers['x-device-token'];
    if (typeof token !== 'string') throw new UnauthorizedException('Token do dispositivo ausente');
    const device = await this.prisma.device.findUnique({ where: { tokenHash: tokenHash(token) } });
    if (!device || device.status !== 'ACTIVE') throw new UnauthorizedException('Dispositivo não autorizado');
    req.device = device; return true;
  }
}
