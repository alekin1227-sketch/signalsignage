import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

@Module({ imports: [MediaModule], controllers: [WidgetController], providers: [WidgetService], exports: [WidgetService] })
export class WidgetModule {}
