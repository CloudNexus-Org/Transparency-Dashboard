// AI assisted development
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GraphPlannerService } from '../integrations/graph-planner.service';
import { GithubService } from '../integrations/github.service';
import { RiskEngineService } from '../risks/risk-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: GraphPlannerService,
    private readonly github: GithubService,
    private readonly riskEngine: RiskEngineService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyChecks(): Promise<void> {
    if (this.config.get<string>('ENABLE_ALERT_CRON') !== 'true') {
      return;
    }
    const projects = await this.prisma.project.findMany();
    for (const p of projects) {
      try {
        const planner = p.plannerPlanId
          ? await this.planner.fetchPlannerSnapshot(p.plannerPlanId)
          : null;
        const gh =
          p.githubOwner && p.githubRepo
            ? await this.github.fetchRepoSnapshot(p.githubOwner, p.githubRepo)
            : null;
        const risk = this.riskEngine.evaluate(planner, gh);
        const previous = await this.prisma.riskSnapshot.findFirst({
          where: { projectId: p.id },
          orderBy: { createdAt: 'desc' },
        });
        await this.prisma.riskSnapshot.create({
          data: {
            projectId: p.id,
            level: risk.level,
            score: risk.score,
            factors: risk.factors as object[],
          },
        });
        if (planner && planner.overdueCount > 0) {
          await this.notifications.createForProjectMembers(
            p.id,
            'TASK_OVERDUE',
            'Overdue tasks detected',
            `${planner.overdueCount} task(s) in ${p.name} are past due.`,
          );
        }
        if (gh && gh.commitsLast7Days === 0) {
          await this.notifications.createForProjectMembers(
            p.id,
            'LOW_ACTIVITY',
            'Low repository activity',
            `No commits were recorded in the last 7 days for ${p.name}.`,
          );
        }
        if (
          previous &&
          risk.score > previous.score + 15 &&
          risk.score >= 40
        ) {
          await this.notifications.createForProjectMembers(
            p.id,
            'RISK_INCREASED',
            'Risk level increased',
            `Risk score for ${p.name} rose to ${risk.score} (${risk.level}).`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `Alert check failed for project ${p.id}: ${(e as Error).message}`,
        );
      }
    }
  }
}
