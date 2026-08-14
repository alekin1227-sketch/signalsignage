import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { tokenHash } from '../player/device-token.guard';

@Injectable()
@WebSocketGateway({ cors: { origin: true, credentials: true }, namespace: '/signage' })
export class RealtimeGateway {
  @WebSocketServer() server!: Server;
  constructor(private prisma: PrismaService, private jwt: JwtService) {}
  async handleConnection(client: Socket) {
    try {
      const deviceToken = client.handshake.auth.deviceToken;
      if (deviceToken) {
        const device = await this.prisma.device.findUnique({ where: { tokenHash: tokenHash(deviceToken) } });
        if (!device || device.status !== 'ACTIVE') throw new Error();
        client.data.deviceId = device.id; client.join(`device:${device.id}`);
        await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
        this.server.to('dashboard').emit('device-status', { id: device.id, online: true, lastSeenAt: new Date() });
      } else {
        await this.jwt.verifyAsync(client.handshake.auth.accessToken); client.join('dashboard');
      }
    } catch { client.disconnect(true); }
  }
  async handleDisconnect(client: Socket) {
    if (client.data.deviceId) this.server.to('dashboard').emit('device-status', { id: client.data.deviceId, online: false, lastSeenAt: new Date() });
  }
  @SubscribeMessage('now-playing') async nowPlaying(@ConnectedSocket() client: Socket, @MessageBody() body: { mediaId: string; name: string }) {
    if (!client.data.deviceId) return;
    await this.prisma.device.update({ where: { id: client.data.deviceId }, data: { nowPlayingId: body.mediaId, nowPlayingName: body.name, nowPlayingAt: new Date(), lastSeenAt: new Date() } });
    this.server.to('dashboard').emit('now-playing', { deviceId: client.data.deviceId, ...body, at: new Date() });
  }
  async refreshDevice(id: string) {
    const recipients = (await this.server.in(`device:${id}`).fetchSockets()).length;
    this.server.to(`device:${id}`).emit('refresh-queue');
    return recipients;
  }
  async emergency(id: string, playlistId: string, commandId: string) {
    const recipients = (await this.server.in(`device:${id}`).fetchSockets()).length;
    this.server.to(`device:${id}`).emit('emergency', { playlistId, commandId });
    return recipients;
  }
  control(id: string, command: { action: string; seconds?: number }) { this.server.to(`device:${id}`).emit('player-control', command); }
}
