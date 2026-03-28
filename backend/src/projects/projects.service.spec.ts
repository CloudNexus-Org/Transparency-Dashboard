// AI assisted development
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, Project } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { GraphPlannerService } from '../integrations/graph-planner.service';
import { GithubService } from '../integrations/github.service';
import { RiskEngineService } from '../risks/risk-engine.service';
import { SummaryService } from '../ai/summary.service';

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation((): Record<string, unknown> => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    const doc: Record<string, unknown> = {
      on: jest.fn((ev: string, fn: (...args: unknown[]) => void) => {
        (listeners[ev] ??= []).push(fn);
        return doc;
      }),
      fontSize: jest.fn().mockImplementation(() => doc),
      text: jest.fn().mockImplementation(() => doc),
      moveDown: jest.fn().mockImplementation(() => doc),
      end: jest.fn(() => {
        for (const fn of listeners['data'] ?? []) {
          fn(Buffer.from('%PDF'));
        }
        for (const fn of listeners['end'] ?? []) {
          fn();
        }
      }),
    };
    return doc;
  });
});

describe('ProjectsService', () => {
  let prisma: {
    project: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    projectMember: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    riskSnapshot: { findMany: jest.Mock };
  };
  let planner: jest.Mocked<Pick<GraphPlannerService, 'fetchPlannerSnapshot'>>;
  let github: jest.Mocked<Pick<GithubService, 'fetchRepoSnapshot'>>;
  let riskEngine: RiskEngineService;
  let summary: jest.Mocked<Pick<SummaryService, 'weeklyClientSummary'>>;
  let config: { get: jest.Mock };
  let service: ProjectsService;

  const baseProject: Project = {
    id: 'proj-1',
    name: 'Alpha',
    description: 'D',
    startDate: new Date('2026-01-01'),
    targetEndDate: new Date('2026-12-31'),
    plannerPlanId: null,
    githubOwner: null,
    githubRepo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      riskSnapshot: { findMany: jest.fn() },
    };
    planner = { fetchPlannerSnapshot: jest.fn() };
    github = { fetchRepoSnapshot: jest.fn() };
    riskEngine = new RiskEngineService();
    summary = {
      weeklyClientSummary: jest.fn().mockResolvedValue('Weekly text'),
    };
    config = { get: jest.fn() };
    service = new ProjectsService(
      prisma as unknown as PrismaService,
      planner as unknown as GraphPlannerService,
      github as unknown as GithubService,
      riskEngine,
      summary as unknown as SummaryService,
      config as unknown as ConfigService,
    );
  });

  describe('assertProjectAccess', () => {
    it('throws NotFound when project missing', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(
        service.assertProjectAccess('u1', UserRole.CLIENT, 'p1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows admin without membership', async () => {
      prisma.project.findUnique.mockResolvedValue(baseProject);
      await expect(
        service.assertProjectAccess('u1', UserRole.ADMIN, 'proj-1'),
      ).resolves.toEqual(baseProject);
    });

    it('allows client with membership', async () => {
      prisma.project.findUnique.mockResolvedValue(baseProject);
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'm1' });
      await expect(
        service.assertProjectAccess('u1', UserRole.CLIENT, 'proj-1'),
      ).resolves.toEqual(baseProject);
    });

    it('throws Forbidden for client without membership', async () => {
      prisma.project.findUnique.mockResolvedValue(baseProject);
      prisma.projectMember.findUnique.mockResolvedValue(null);
      await expect(
        service.assertProjectAccess('u1', UserRole.CLIENT, 'proj-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listForUser', () => {
    it('lists all for admin', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      await service.listForUser('u1', UserRole.ADMIN);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
          include: { _count: { select: { members: true } } },
        }),
      );
    });

    it('filters by membership for client', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      await service.listForUser('u1', UserRole.CLIENT);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { members: { some: { userId: 'u1' } } },
        }),
      );
    });
  });

  describe('create / update / members', () => {
    it('create passes dto to prisma', async () => {
      prisma.project.create.mockResolvedValue(baseProject);
      await service.create({
        name: 'N',
        description: 'x',
        startDate: '2026-01-01',
        targetEndDate: '2026-02-01',
        plannerPlanId: 'plan',
        githubOwner: 'o',
        githubRepo: 'r',
      });
      expect(prisma.project.create).toHaveBeenCalled();
    });

    it('update passes through to prisma', async () => {
      prisma.project.update.mockResolvedValue(baseProject);
      await service.update('id', { name: 'Renamed' });
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'id' },
          data: expect.objectContaining({ name: 'Renamed' }),
        }),
      );
    });

    it('assignMember upserts', async () => {
      prisma.projectMember.upsert.mockResolvedValue({} as never);
      await service.assignMember('p', 'u');
      expect(prisma.projectMember.upsert).toHaveBeenCalled();
    });

    it('removeMember deletes', async () => {
      prisma.projectMember.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.removeMember('p', 'u')).resolves.toEqual({
        ok: true,
      });
    });
  });

  describe('dashboard', () => {
    beforeEach(() => {
      prisma.project.findUnique.mockResolvedValue(baseProject);
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'm' });
    });

    it('uses demo planner when DEMO_DATA true and no live planner', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'DEMO_DATA' ? 'true' : undefined,
      );
      planner.fetchPlannerSnapshot.mockResolvedValue(null);
      github.fetchRepoSnapshot.mockResolvedValue(null);
      const dash = await service.dashboard('u1', UserRole.CLIENT, 'proj-1');
      expect(dash.planner?.planTitle).toContain('demo');
      expect(dash.weeklySummary).toBe('Weekly text');
      expect(summary.weeklyClientSummary).toHaveBeenCalled();
    });

    it('returns null planner when live fetch fails and demo off', async () => {
      config.get.mockReturnValue(undefined);
      const proj = { ...baseProject, plannerPlanId: 'plan-x' };
      prisma.project.findUnique.mockResolvedValue(proj);
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'm' });
      planner.fetchPlannerSnapshot.mockResolvedValue(null);
      github.fetchRepoSnapshot.mockResolvedValue(null);
      const dash = await service.dashboard('u1', UserRole.CLIENT, 'proj-1');
      expect(dash.planner).toBeNull();
    });

    it('loads GitHub when owner and repo set', async () => {
      config.get.mockReturnValue(undefined);
      const proj = {
        ...baseProject,
        githubOwner: 'o',
        githubRepo: 'r',
      };
      prisma.project.findUnique.mockResolvedValue(proj);
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'm' });
      github.fetchRepoSnapshot.mockResolvedValue({
        recentCommits: [],
        pullRequests: [],
        contributors: [],
        commitsLast7Days: 0,
      });
      const dash = await service.dashboard('u1', UserRole.CLIENT, 'proj-1');
      expect(github.fetchRepoSnapshot).toHaveBeenCalledWith('o', 'r');
      expect(dash.github).not.toBeNull();
    });

    it('uses live planner when fetch returns data', async () => {
      config.get.mockReturnValue(undefined);
      planner.fetchPlannerSnapshot.mockResolvedValue({
        planId: 'p',
        planTitle: 'Live',
        buckets: [],
        tasks: [],
        progressPercent: 50,
        completedCount: 1,
        activeCount: 1,
        totalCount: 2,
        overdueCount: 0,
        stuckInProgressCount: 0,
        completionTrend: [],
      });
      github.fetchRepoSnapshot.mockResolvedValue({
        recentCommits: [],
        pullRequests: [],
        contributors: [],
        commitsLast7Days: 5,
      });
      const proj = { ...baseProject, plannerPlanId: 'plan-id' };
      prisma.project.findUnique.mockResolvedValue(proj);
      const dash = await service.dashboard('u1', UserRole.CLIENT, 'proj-1');
      expect(dash.planner?.planTitle).toBe('Live');
    });
  });

  describe('exportCsv and riskHistory', () => {
    beforeEach(() => {
      prisma.project.findUnique.mockResolvedValue(baseProject);
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'm' });
      config.get.mockImplementation((k: string) =>
        k === 'DEMO_DATA' ? 'true' : undefined,
      );
      planner.fetchPlannerSnapshot.mockResolvedValue(null);
      github.fetchRepoSnapshot.mockResolvedValue(null);
    });

    it('exportCsv includes escaped project name', async () => {
      prisma.project.findUnique.mockResolvedValue({
        ...baseProject,
        name: 'Say "Hi"',
      });
      const csv = await service.exportCsv('u1', UserRole.CLIENT, 'proj-1');
      expect(csv).toContain('Say ""Hi""');
    });

    it('riskHistory returns prisma rows', async () => {
      prisma.riskSnapshot.findMany.mockResolvedValue([{ id: 'r1' }]);
      await expect(
        service.riskHistory('u1', UserRole.CLIENT, 'proj-1'),
      ).resolves.toEqual([{ id: 'r1' }]);
    });
  });

  describe('exportPdf', () => {
    beforeEach(() => {
      prisma.project.findUnique.mockResolvedValue(baseProject);
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'm' });
      config.get.mockImplementation((k: string) =>
        k === 'DEMO_DATA' ? 'true' : undefined,
      );
      planner.fetchPlannerSnapshot.mockResolvedValue(null);
      github.fetchRepoSnapshot.mockResolvedValue(null);
    });

    it('returns a buffer', async () => {
      const buf = await service.exportPdf('u1', UserRole.CLIENT, 'proj-1');
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
    });
  });
});
