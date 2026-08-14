import { Body, Controller, Get, Headers, Ip, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DeviceTokenGuard } from './device-token.guard';
import { HeartbeatDto, RegisterDeviceDto } from './dto';
import { PlayerService } from './player.service';

@Controller('player')
export class PlayerController {
  constructor(private player: PlayerService) {}
  @Post('register')
  register(@Body() dto: RegisterDeviceDto, @Headers('x-enrollment-key') key: string, @Ip() ip: string) { return this.player.register(dto, key, ip); }
  @Get('queue') @UseGuards(DeviceTokenGuard)
  queue(@Req() req: Request & { device: { id: string } }) { return this.player.queue(req.device.id); }
  @Get('playlist/:playlistId') @UseGuards(DeviceTokenGuard)
  playlist(@Req() req: Request & { device: { id: string } }, @Param('playlistId') id: string) { return this.player.queue(req.device.id, id); }
  @Post('heartbeat') @UseGuards(DeviceTokenGuard)
  heartbeat(@Req() req: Request & { device: { id: string } }, @Body() dto: HeartbeatDto, @Ip() ip: string) { return this.player.heartbeat(req.device.id, dto, ip); }
}
