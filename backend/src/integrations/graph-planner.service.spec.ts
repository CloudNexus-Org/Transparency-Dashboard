// AI assisted development
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GraphPlannerService } from './graph-planner.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GraphPlannerService', () => {
  let config: { get: jest.Mock };
  let service: GraphPlannerService;

  beforeEach(() => {
    config = { get: jest.fn() };
    service = new GraphPlannerService(config as unknown as ConfigService);
    jest.clearAllMocks();
  });

  describe('resolveToken', () => {
    it('returns GRAPH_ACCESS_TOKEN when set', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'GRAPH_ACCESS_TOKEN' ? 'static-token' : undefined,
      );
      await expect(service.resolveToken()).resolves.toBe('static-token');
    });

    it('returns null when app token fails', async () => {
      config.get.mockReturnValue(undefined);
      mockedAxios.post.mockRejectedValue(new Error('fail'));
      await expect(service.resolveToken()).resolves.toBeNull();
    });

    it('returns token from client credentials when post succeeds', async () => {
      config.get.mockImplementation((k: string) => {
        const m: Record<string, string> = {
          MICROSOFT_TENANT_ID: 't',
          MICROSOFT_CLIENT_ID: 'id',
          MICROSOFT_CLIENT_SECRET: 'sec',
        };
        return m[k];
      });
      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'app-token' },
      } as never);
      await expect(service.resolveToken()).resolves.toBe('app-token');
    });
  });

  describe('getApplicationAccessToken', () => {
    it('returns null when credentials incomplete', async () => {
      config.get.mockReturnValue(undefined);
      await expect(service.getApplicationAccessToken()).resolves.toBeNull();
    });
  });

  describe('fetchPlannerSnapshot', () => {
    it('returns null when no token', async () => {
      jest.spyOn(service, 'resolveToken').mockResolvedValue(null);
      await expect(service.fetchPlannerSnapshot('plan')).resolves.toBeNull();
    });

    it('handles empty task list', async () => {
      jest.spyOn(service, 'resolveToken').mockResolvedValue('tok');
      const get = jest
        .fn()
        .mockResolvedValueOnce({ data: { title: 'Empty', id: 'plan' } })
        .mockResolvedValueOnce({ data: { value: [] } })
        .mockResolvedValueOnce({ data: { value: [] } });
      mockedAxios.create.mockReturnValue({ get } as never);
      const snap = await service.fetchPlannerSnapshot('plan');
      expect(snap!.totalCount).toBe(0);
      expect(snap!.progressPercent).toBe(0);
    });

    it('maps tasks and metrics when Graph calls succeed', async () => {
      jest.spyOn(service, 'resolveToken').mockResolvedValue('tok');
      const get = jest
        .fn()
        .mockResolvedValueOnce({ data: { title: 'Plan A', id: 'plan' } })
        .mockResolvedValueOnce({
          data: { value: [{ id: 'b1', name: 'To Do' }] },
        })
        .mockResolvedValueOnce({
          data: {
            value: [
              {
                id: 't1',
                title: 'Task',
                bucketId: 'b1',
                percentComplete: 100,
                dueDateTime: '2026-01-01T00:00:00Z',
                createdDateTime: '2026-01-01T00:00:00Z',
              },
            ],
          },
        });
      mockedAxios.create.mockReturnValue({ get } as never);

      const snap = await service.fetchPlannerSnapshot('plan');
      expect(snap).not.toBeNull();
      expect(snap!.planTitle).toBe('Plan A');
      expect(snap!.totalCount).toBe(1);
      expect(snap!.progressPercent).toBe(100);
    });

    it('returns null when Graph throws', async () => {
      jest.spyOn(service, 'resolveToken').mockResolvedValue('tok');
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('boom')),
      } as never);
      await expect(service.fetchPlannerSnapshot('plan')).resolves.toBeNull();
    });

    it('marks tasks in Done bucket complete and counts overdue', async () => {
      jest.spyOn(service, 'resolveToken').mockResolvedValue('tok');
      const past = '2020-01-01T00:00:00Z';
      const get = jest
        .fn()
        .mockResolvedValueOnce({ data: { title: 'P', id: 'plan' } })
        .mockResolvedValueOnce({
          data: {
            value: [
              { id: 'bd', name: 'Done' },
              { id: 'bx', name: 'Backlog' },
              { id: 'bp', name: 'In Progress' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            value: [
              {
                id: 't-done',
                title: 'A',
                bucketId: 'bd',
                percentComplete: 0,
                dueDateTime: past,
                createdDateTime: past,
              },
              {
                id: 't-late',
                title: 'B',
                bucketId: 'bx',
                percentComplete: 0,
                dueDateTime: past,
                createdDateTime: past,
              },
              {
                id: 't-stuck',
                title: 'C',
                bucketId: 'bp',
                percentComplete: 50,
                dueDateTime: undefined,
                createdDateTime: '2020-01-01T00:00:00Z',
              },
            ],
          },
        });
      mockedAxios.create.mockReturnValue({ get } as never);
      const snap = await service.fetchPlannerSnapshot('plan');
      expect(snap!.tasks.find((x) => x.id === 't-done')?.status).toBe(
        'Completed',
      );
      expect(snap!.overdueCount).toBeGreaterThanOrEqual(1);
      expect(snap!.stuckInProgressCount).toBeGreaterThanOrEqual(1);
    });
  });
});
