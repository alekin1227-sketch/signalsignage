import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
@Module({ imports: [RealtimeModule], controllers: [DeviceController], providers: [DeviceService] })
export class DeviceModule {}
