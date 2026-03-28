// AI assisted development
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export type PlannerTaskView = {
  id: string;
  title: string;
  bucketId: string;
  bucketName: string;
  percentComplete: number;
  dueDateTime: string | null;
  createdDateTime: string | null;
  status: 'Not Started' | 'In Progress' | 'Completed';
};

export type PlannerSnapshot = {
  planId: string;
  planTitle: string;
  buckets: { id: string; name: string }[];
  tasks: PlannerTaskView[];
  progressPercent: number;
  completedCount: number;
  activeCount: number;
  totalCount: number;
  overdueCount: number;
  stuckInProgressCount: number;
  completionTrend: { date: string; completedDelta: number }[];
};

@Injectable()
export class GraphPlannerService {
  private readonly logger = new Logger(GraphPlannerService.name);

  constructor(private readonly config: ConfigService) {}

  private createClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 25_000,
    });
  }

  async getApplicationAccessToken(): Promise<string | null> {
    const tenant = this.config.get<string>('MICROSOFT_TENANT_ID');
    const clientId = this.config.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = this.config.get<string>('MICROSOFT_CLIENT_SECRET');
    if (!tenant || !clientId || !clientSecret) {
      return null;
    }
    const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });
    const res = await axios.post<{ access_token: string }>(
      url,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    return res.data.access_token;
  }

  /**
   * Uses GRAPH_ACCESS_TOKEN env, application token, or returns null (demo mode).
   */
  async resolveToken(): Promise<string | null> {
    const staticToken = this.config.get<string>('GRAPH_ACCESS_TOKEN');
    if (staticToken) {
      return staticToken;
    }
    try {
      return await this.getApplicationAccessToken();
    } catch (e) {
      this.logger.warn(`Application token failed: ${(e as Error).message}`);
      return null;
    }
  }

  async fetchPlannerSnapshot(planId: string): Promise<PlannerSnapshot | null> {
    const token = await this.resolveToken();
    if (!token) {
      return null;
    }
    const client = this.createClient(token);
    try {
      const planRes = await client.get<{ title?: string; id: string }>(
        `/planner/plans/${planId}`,
      );
      const bucketsRes = await client.get<{ value: { id: string; name: string }[] }>(
        `/planner/plans/${planId}/buckets`,
      );
      const tasksRes = await client.get<{
        value: {
          id: string;
          title?: string;
          bucketId: string;
          percentComplete: number;
          dueDateTime?: string;
          createdDateTime?: string;
        }[];
      }>(`/planner/plans/${planId}/tasks`);
      const buckets = bucketsRes.data.value ?? [];
      const bucketMap = new Map(buckets.map((b) => [b.id, b.name]));
      const now = Date.now();
      const tasks: PlannerTaskView[] = (tasksRes.data.value ?? []).map((t) => {
        const bucketName = bucketMap.get(t.bucketId) ?? 'Unknown';
        let status: PlannerTaskView['status'] = 'Not Started';
        if (t.percentComplete === 100) {
          status = 'Completed';
        } else if (
          bucketName.toLowerCase().includes('done') ||
          bucketName.toLowerCase().includes('complete')
        ) {
          status = 'Completed';
          t = { ...t, percentComplete: 100 };
        } else if (
          t.percentComplete > 0 ||
          bucketName.toLowerCase().includes('progress')
        ) {
          status = 'In Progress';
        } else if (bucketName.toLowerCase().includes('to do')) {
          status = 'Not Started';
        } else if (t.percentComplete === 0) {
          status = 'Not Started';
        }
        return {
          id: t.id,
          title: t.title ?? '(untitled)',
          bucketId: t.bucketId,
          bucketName,
          percentComplete: t.percentComplete,
          dueDateTime: t.dueDateTime ?? null,
          createdDateTime: t.createdDateTime ?? null,
          status,
        };
      });
      const total = tasks.length;
      const completed = tasks.filter((x) => x.status === 'Completed').length;
      const progressPercent =
        total === 0 ? 0 : Math.round((completed / total) * 100);
      const overdueCount = tasks.filter(
        (x) =>
          x.status !== 'Completed' &&
          x.dueDateTime &&
          new Date(x.dueDateTime).getTime() < now,
      ).length;
      const stuckInProgressCount = tasks.filter((x) => {
        if (x.status !== 'In Progress' || !x.createdDateTime) {
          return false;
        }
        const age = now - new Date(x.createdDateTime).getTime();
        return age > 7 * 24 * 60 * 60 * 1000;
      }).length;
      const completionTrend = this.buildCompletionTrend(tasks);
      return {
        planId,
        planTitle: planRes.data.title ?? 'Plan',
        buckets,
        tasks,
        progressPercent,
        completedCount: completed,
        activeCount: total - completed,
        totalCount: total,
        overdueCount,
        stuckInProgressCount,
        completionTrend,
      };
    } catch (e) {
      this.logger.error(
        `Planner fetch failed for ${planId}: ${(e as Error).message}`,
      );
      return null;
    }
  }

  private buildCompletionTrend(
    tasks: PlannerTaskView[],
  ): { date: string; completedDelta: number }[] {
    const byDay = new Map<string, number>();
    for (const t of tasks) {
      if (t.status !== 'Completed' || !t.createdDateTime) {
        continue;
      }
      const d = t.dueDateTime ?? t.createdDateTime;
      const key = d.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const keys = [...byDay.keys()].sort();
    return keys.map((date) => ({
      date,
      completedDelta: byDay.get(date) ?? 0,
    }));
  }
}
