// AI assisted development
import { Injectable } from '@nestjs/common';
import { RiskLevel } from '@prisma/client';
import { PlannerSnapshot } from '../integrations/graph-planner.service';
import { GithubSnapshot } from '../integrations/github.service';

export type RiskFactor = {
  code: string;
  message: string;
  weight: number;
};

export type RiskAssessment = {
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
};

@Injectable()
export class RiskEngineService {
  evaluate(
    planner: PlannerSnapshot | null,
    github: GithubSnapshot | null,
  ): RiskAssessment {
    const factors: RiskFactor[] = [];
    let score = 0;
    if (planner && planner.totalCount > 0) {
      const overdueRatio = planner.overdueCount / planner.totalCount;
      if (overdueRatio > 0.25) {
        factors.push({
          code: 'OVERDUE_TASKS_HIGH',
          message: 'A large share of tasks are past due.',
          weight: 35,
        });
        score += 35;
      } else if (overdueRatio > 0.1) {
        factors.push({
          code: 'OVERDUE_TASKS_MODERATE',
          message: 'Several tasks are overdue.',
          weight: 18,
        });
        score += 18;
      }
      if (planner.stuckInProgressCount >= 5) {
        factors.push({
          code: 'STUCK_IN_PROGRESS',
          message: 'Multiple tasks have stayed in progress for over a week.',
          weight: 22,
        });
        score += 22;
      } else if (planner.stuckInProgressCount >= 2) {
        factors.push({
          code: 'STUCK_IN_PROGRESS_LIGHT',
          message: 'Some tasks have been in progress for an extended period.',
          weight: 10,
        });
        score += 10;
      }
      if (planner.progressPercent < 30 && planner.totalCount > 10) {
        factors.push({
          code: 'LOW_PLANNER_PROGRESS',
          message: 'Overall planner completion is still low relative to scope.',
          weight: 12,
        });
        score += 12;
      }
    }
    if (github) {
      if (github.commitsLast7Days === 0 && github.recentCommits.length > 0) {
        factors.push({
          code: 'LOW_DEV_ACTIVITY',
          message: 'No commits detected in the last 7 days.',
          weight: 25,
        });
        score += 25;
      } else if (github.commitsLast7Days < 3) {
        factors.push({
          code: 'LIGHT_DEV_ACTIVITY',
          message: 'Development activity in the last week has been light.',
          weight: 12,
        });
        score += 12;
      }
    } else if (planner && planner.totalCount > 0) {
      factors.push({
        code: 'GITHUB_UNAVAILABLE',
        message: 'Repository activity could not be verified.',
        weight: 5,
      });
      score += 5;
    }
    const level =
      score >= 55 ? RiskLevel.HIGH : score >= 28 ? RiskLevel.MEDIUM : RiskLevel.LOW;
    return { level, score: Math.min(100, score), factors };
  }
}
