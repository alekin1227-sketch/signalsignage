import { Module } from '@nestjs/common';
import { DeviceTokenGuard } from './device-token.guard';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
@Module({ controllers: [PlayerController], providers: [PlayerService, DeviceTokenGuard] }) export class PlayerModule {}
