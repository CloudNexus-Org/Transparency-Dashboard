// AI assisted development
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GraphPlannerService, PlannerSnapshot } from '../integrations/graph-planner.service';
import { GithubService } from '../integrations/github.service';
import { RiskEngineService } from '../risks/risk-engine.service';
import { SummaryService } from '../ai/summary.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import PDFDocument from 'pdfkit';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: GraphPlannerService,
    private readonly github: GithubService,
    private readonly riskEngine: RiskEngineService,
    private readonly summary: SummaryService,
    private readonly config: ConfigService,
  ) {}

  private demoPlanner(project: Project): PlannerSnapshot {
    const today = new Date().toISOString().slice(0, 10);
    return {
      planId: project.plannerPlanId ?? 'demo',
      planTitle: `${project.name} (demo data)`,
      buckets: [
        { id: '1', name: 'To Do' },
        { id: '2', name: 'In Progress' },
        { id: '3', name: 'Done' },
      ],
      tasks: [
        {
          id: 't1',
          title: 'Discovery workshop',
          bucketId: '3',
          bucketName: 'Done',
          percentComplete: 100,
          dueDateTime: today,
          createdDateTime: today,
          status: 'Completed',
        },
        {
          id: 't2',
          title: 'API integration',
          bucketId: '2',
          bucketName: 'In Progress',
          percentComplete: 50,
          dueDateTime: today,
          createdDateTime: new Date(
            Date.now() - 10 * 86400000,
          ).toISOString(),
          status: 'In Progress',
        },
        {
          id: 't3',
          title: 'UAT sign-off',
          bucketId: '1',
          bucketName: 'To Do',
          percentComplete: 0,
          dueDateTime: new Date(Date.now() + 86400000).toISOString(),
          createdDateTime: today,
          status: 'Not Started',
        },
      ],
      progressPercent: 33,
      completedCount: 1,
      activeCount: 2,
      totalCount: 3,
      overdueCount: 0,
      stuckInProgressCount: 1,
      completionTrend: [{ date: today, completedDelta: 1 }],
    };
  }

  async assertProjectAccess(
    userId: string,
    role: UserRole,
    projectId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (role === UserRole.ADMIN) {
      return project;
    }
    const member = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });
    if (!member) {
      throw new ForbiddenException('No access to this project');
    }
    return project;
  }

  async listForUser(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      return this.prisma.project.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { members: true } },
        },
      });
    }
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        targetEndDate: dto.targetEndDate
          ? new Date(dto.targetEndDate)
          : undefined,
        plannerPlanId: dto.plannerPlanId,
        githubOwner: dto.githubOwner,
        githubRepo: dto.githubRepo,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate:
          dto.startDate === undefined
            ? undefined
            : dto.startDate
              ? new Date(dto.startDate)
              : null,
        targetEndDate:
          dto.targetEndDate === undefined
            ? undefined
            : dto.targetEndDate
              ? new Date(dto.targetEndDate)
              : null,
        plannerPlanId: dto.plannerPlanId,
        githubOwner: dto.githubOwner,
        githubRepo: dto.githubRepo,
      },
    });
  }

  async assignMember(projectId: string, userId: string) {
    return this.prisma.projectMember.upsert({
      where: {
        userId_projectId: { userId, projectId },
      },
      create: { userId, projectId },
      update: {},
    });
  }

  async removeMember(projectId: string, userId: string) {
    await this.prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });
    return { ok: true };
  }

  private async loadPlanner(project: Project): Promise<PlannerSnapshot | null> {
    const demo = this.config.get<string>('DEMO_DATA') === 'true';
    if (project.plannerPlanId) {
      const live = await this.planner.fetchPlannerSnapshot(project.plannerPlanId);
      if (live) {
        return live;
      }
    }
    if (demo) {
      return this.demoPlanner(project);
    }
    return null;
  }

  private async loadGithub(project: Project) {
    if (project.githubOwner && project.githubRepo) {
      return this.github.fetchRepoSnapshot(
        project.githubOwner,
        project.githubRepo,
      );
    }
    if (this.config.get<string>('DEMO_DATA') === 'true') {
      return {
        recentCommits: [
          {
            sha: 'abc1234',
            message: 'feat: transparency dashboard API',
            author: 'Dev Team',
            date: new Date().toISOString(),
            url: 'https://github.com',
          },
        ],
        pullRequests: [
          {
            number: 12,
            title: 'Planner sync hardening',
            state: 'open',
            mergedAt: null,
            htmlUrl: 'https://github.com',
            author: 'dev1',
          },
        ],
        contributors: [{ login: 'dev1', contributions: 24, avatarUrl: '' }],
        commitsLast7Days: 4,
      };
    }
    return null;
  }

  async dashboard(userId: string, role: UserRole, projectId: string) {
    const project = await this.assertProjectAccess(userId, role, projectId);
    const [planner, gh] = await Promise.all([
      this.loadPlanner(project),
      this.loadGithub(project),
    ]);
    const risk = this.riskEngine.evaluate(planner, gh);
    const milestones = this.buildTimeline(project, planner);
    const weeklySummary = await this.summary.weeklyClientSummary({
      projectName: project.name,
      progressPercent: planner?.progressPercent ?? 0,
      risk,
      overdueCount: planner?.overdueCount ?? 0,
      commitsLast7Days: gh?.commitsLast7Days ?? 0,
    });
    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        startDate: project.startDate,
        targetEndDate: project.targetEndDate,
      },
      planner: planner
        ? {
            planTitle: planner.planTitle,
            progressPercent: planner.progressPercent,
            completedCount: planner.completedCount,
            activeCount: planner.activeCount,
            totalCount: planner.totalCount,
            buckets: planner.buckets,
            tasks: planner.tasks,
            completionTrend: planner.completionTrend,
            overdueCount: planner.overdueCount,
            stuckInProgressCount: planner.stuckInProgressCount,
          }
        : null,
      github: gh,
      risk,
      timeline: milestones,
      weeklySummary,
    };
  }

  private buildTimeline(project: Project, planner: PlannerSnapshot | null) {
    const items: {
      id: string;
      label: string;
      date: string;
      type: 'start' | 'due' | 'target';
      delayed?: boolean;
    }[] = [];
    if (project.startDate) {
      items.push({
        id: 'start',
        label: 'Project start',
        date: project.startDate.toISOString(),
        type: 'start',
      });
    }
    if (project.targetEndDate) {
      items.push({
        id: 'target',
        label: 'Target delivery',
        date: project.targetEndDate.toISOString(),
        type: 'target',
      });
    }
    const now = Date.now();
    for (const t of planner?.tasks ?? []) {
      if (!t.dueDateTime) {
        continue;
      }
      const due = new Date(t.dueDateTime).getTime();
      const delayed =
        t.status !== 'Completed' && due < now;
      items.push({
        id: t.id,
        label: t.title,
        date: t.dueDateTime,
        type: 'due',
        delayed,
      });
    }
    items.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return items;
  }

  async exportCsv(userId: string, role: UserRole, projectId: string) {
    const data = await this.dashboard(userId, role, projectId);
    const lines = [
      'section,key,value',
      `project,name,"${data.project.name.replace(/"/g, '""')}"`,
      `planner,progress,${data.planner?.progressPercent ?? 0}`,
      `planner,completed,${data.planner?.completedCount ?? 0}`,
      `planner,total,${data.planner?.totalCount ?? 0}`,
      `risk,level,${data.risk.level}`,
      `risk,score,${data.risk.score}`,
    ];
    return lines.join('\n');
  }

  async riskHistory(userId: string, role: UserRole, projectId: string) {
    await this.assertProjectAccess(userId, role, projectId);
    return this.prisma.riskSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        level: true,
        score: true,
        factors: true,
        createdAt: true,
      },
    });
  }

  async exportPdf(userId: string, role: UserRole, projectId: string) {
    const data = await this.dashboard(userId, role, projectId);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(20).text(data.project.name, { underline: true });
      doc.moveDown();
      doc.fontSize(11).text(
        `Progress: ${data.planner?.progressPercent ?? 0}% | Tasks: ${data.planner?.completedCount ?? 0}/${data.planner?.totalCount ?? 0} complete`,
      );
      doc.text(`Risk: ${data.risk.level} (${data.risk.score}/100)`);
      doc.moveDown();
      doc.fontSize(12).text('Weekly summary', { underline: true });
      doc.fontSize(10).text(data.weeklySummary, { align: 'left' });
      doc.moveDown();
      doc.fontSize(12).text('Risk factors', { underline: true });
      for (const f of data.risk.factors) {
        doc.fontSize(10).text(`• ${f.message}`);
      }
      doc.end();
    });
  }
}
