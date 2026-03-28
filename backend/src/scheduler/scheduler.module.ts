// AI assisted development
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertsScheduler } from './alerts.scheduler';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RiskEngineService } from '../risks/risk-engine.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    IntegrationsModule,
    NotificationsModule,
  ],
  providers: [AlertsScheduler, RiskEngineService],
})
export class AppSchedulerModule {}
