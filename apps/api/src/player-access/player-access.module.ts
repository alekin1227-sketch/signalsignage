import { Module } from '@nestjs/common';
import { PlayerAccessController } from './player-access.controller';
import { PlayerAccessService } from './player-access.service';

@Module({ controllers: [PlayerAccessController], providers: [PlayerAccessService] })
export class PlayerAccessModule {}
