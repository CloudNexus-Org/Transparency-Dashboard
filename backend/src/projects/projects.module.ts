// AI assisted development
import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RiskEngineService } from '../risks/risk-engine.service';
import { SummaryService } from '../ai/summary.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, RiskEngineService, SummaryService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
