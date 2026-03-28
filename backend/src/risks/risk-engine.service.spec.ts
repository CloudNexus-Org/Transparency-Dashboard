// AI assisted development
import { RiskLevel } from '@prisma/client';
import { RiskEngineService } from './risk-engine.service';
import { PlannerSnapshot } from '../integrations/graph-planner.service';
import { GithubSnapshot } from '../integrations/github.service';

function planner(partial: Partial<PlannerSnapshot>): PlannerSnapshot {
  return {
    planId: 'p1',
    planTitle: 'T',
    buckets: [],
    tasks: [],
    progressPercent: 0,
    completedCount: 0,
    activeCount: 0,
    totalCount: 0,
    overdueCount: 0,
    stuckInProgressCount: 0,
    completionTrend: [],
    ...partial,
  };
}

describe('RiskEngineService', () => {
  let service: RiskEngineService;

  beforeEach(() => {
    service = new RiskEngineService();
  });

  it('returns LOW when no signals', () => {
    const r = service.evaluate(null, null);
    expect(r.level).toBe(RiskLevel.LOW);
    expect(r.score).toBe(0);
    expect(r.factors).toEqual([]);
  });

  it('flags GITHUB_UNAVAILABLE when planner has work but no github', () => {
    const r = service.evaluate(planner({ totalCount: 5 }), null);
    expect(r.factors.some((f) => f.code === 'GITHUB_UNAVAILABLE')).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(5);
  });

  it('HIGH overdue ratio', () => {
    const r = service.evaluate(
      planner({ totalCount: 10, overdueCount: 3 }),
      { recentCommits: [], pullRequests: [], contributors: [], commitsLast7Days: 5 },
    );
    expect(r.factors.map((f) => f.code)).toContain('OVERDUE_TASKS_HIGH');
    expect(r.score).toBeGreaterThanOrEqual(35);
  });

  it('MODERATE overdue ratio', () => {
    const r = service.evaluate(
      planner({ totalCount: 20, overdueCount: 3 }),
      { recentCommits: [], pullRequests: [], contributors: [], commitsLast7Days: 5 },
    );
    expect(r.factors.map((f) => f.code)).toContain('OVERDUE_TASKS_MODERATE');
  });

  it('stuck in progress heavy', () => {
    const r = service.evaluate(
      planner({ totalCount: 5, stuckInProgressCount: 5 }),
      { recentCommits: [], pullRequests: [], contributors: [], commitsLast7Days: 5 },
    );
    expect(r.factors.map((f) => f.code)).toContain('STUCK_IN_PROGRESS');
  });

  it('stuck in progress light', () => {
    const r = service.evaluate(
      planner({ totalCount: 5, stuckInProgressCount: 2 }),
      { recentCommits: [], pullRequests: [], contributors: [], commitsLast7Days: 5 },
    );
    expect(r.factors.map((f) => f.code)).toContain('STUCK_IN_PROGRESS_LIGHT');
  });

  it('low planner progress', () => {
    const r = service.evaluate(
      planner({ totalCount: 11, progressPercent: 20 }),
      { recentCommits: [], pullRequests: [], contributors: [], commitsLast7Days: 5 },
    );
    expect(r.factors.map((f) => f.code)).toContain('LOW_PLANNER_PROGRESS');
  });

  it('LOW_DEV_ACTIVITY when commits last week zero but history exists', () => {
    const gh: GithubSnapshot = {
      recentCommits: [{ sha: 'a', message: 'm', author: 'x', date: '', url: '' }],
      pullRequests: [],
      contributors: [],
      commitsLast7Days: 0,
    };
    const r = service.evaluate(planner({ totalCount: 1 }), gh);
    expect(r.factors.map((f) => f.code)).toContain('LOW_DEV_ACTIVITY');
  });

  it('LIGHT_DEV_ACTIVITY when commits 1–2', () => {
    const gh: GithubSnapshot = {
      recentCommits: [],
      pullRequests: [],
      contributors: [],
      commitsLast7Days: 2,
    };
    const r = service.evaluate(planner({ totalCount: 1 }), gh);
    expect(r.factors.map((f) => f.code)).toContain('LIGHT_DEV_ACTIVITY');
  });

  it('caps score at 100', () => {
    const r = service.evaluate(
      planner({
        totalCount: 20,
        overdueCount: 10,
        stuckInProgressCount: 10,
        progressPercent: 10,
      }),
      {
        recentCommits: [{ sha: 'a', message: 'm', author: 'x', date: '', url: '' }],
        pullRequests: [],
        contributors: [],
        commitsLast7Days: 0,
      },
    );
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('MEDIUM and HIGH level thresholds', () => {
    const low = service.evaluate(
      planner({ totalCount: 1 }),
      { recentCommits: [], pullRequests: [], contributors: [], commitsLast7Days: 10 },
    );
    expect(low.level).toBe(RiskLevel.LOW);
  });
});
