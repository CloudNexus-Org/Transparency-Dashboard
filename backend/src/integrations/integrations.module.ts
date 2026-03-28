// AI assisted development
import { Module } from '@nestjs/common';
import { GraphPlannerService } from './graph-planner.service';
import { GithubService } from './github.service';

@Module({
  providers: [GraphPlannerService, GithubService],
  exports: [GraphPlannerService, GithubService],
})
export class IntegrationsModule {}
