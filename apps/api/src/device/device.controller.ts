import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { UserRole } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DeviceService } from './device.service';
import { PlayerControlDto, UpdateDeviceDto } from './dto';

@UseGuards(JwtAuthGuard, RolesGuard) @Controller('devices')
export class DeviceController {
  constructor(private devices: DeviceService, private realtime: RealtimeGateway) {}
  @Get() list() { return this.devices.list(); }
  @Patch(':id') @Roles(UserRole.ADMIN, UserRole.EDITOR) update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) { return this.devices.update(id, dto); }
  @Delete(':id') @Roles(UserRole.ADMIN, UserRole.EDITOR) remove(@Param('id') id: string) { return this.devices.remove(id); }
  @Post(':id/refresh') @Roles(UserRole.ADMIN, UserRole.EDITOR) async refresh(@Param('id') id: string) {
    const realtimeRecipients = await this.realtime.refreshDevice(id); return { accepted: true, realtimeRecipients };
  }
  @Post(':id/emergency/clear') @Roles(UserRole.ADMIN, UserRole.EDITOR) async clearEmergency(@Param('id') id: string) {
    await this.devices.clearPlayNow(id);
    const realtimeRecipients = await this.realtime.refreshDevice(id);
    return { accepted: true, realtimeRecipients, fallbackPolling: true };
  }
  @Post(':id/emergency/:playlistId') @Roles(UserRole.ADMIN, UserRole.EDITOR) async emergency(@Param('id') id: string, @Param('playlistId') playlistId: string) {
    const command = await this.devices.playNow(id, playlistId);
    const realtimeRecipients = await this.realtime.emergency(id, playlistId, command.commandId);
    return { accepted: true, realtimeRecipients, fallbackPolling: true, playlist: command.playlist };
  }
  @Post(':id/control') @Roles(UserRole.ADMIN, UserRole.EDITOR) control(@Param('id') id: string, @Body() dto: PlayerControlDto) {
    this.realtime.control(id, dto); return { accepted: true };
  }
}
