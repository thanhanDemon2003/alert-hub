import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './alert.entity';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { EscalationService } from './escalation.service';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert]),
    DevicesModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, EscalationService],
})
export class AlertsModule {}
