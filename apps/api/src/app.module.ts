import { Module } from '@nestjs/common';
import { ScheduleModule } from './schedule/schedule.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { MediaModule } from './media/media.module';
import { PlaylistModule } from './playlist/playlist.module';
import { DeviceModule } from './device/device.module';
import { PlayerModule } from './player/player.module';
import { RealtimeModule } from './realtime/realtime.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UsersModule } from './users/users.module';
import { PlayerAccessModule } from './player-access/player-access.module';
import { WidgetModule } from './widget/widget.module';
import { IntegrationModule } from './integration/integration.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    PrismaModule, AuthModule, MediaModule,
    PlaylistModule, DeviceModule, ScheduleModule, PlayerModule, RealtimeModule, DashboardModule, UsersModule, PlayerAccessModule, WidgetModule, IntegrationModule,
  ],
})
export class AppModule {}
