// AI assisted development
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GithubService } from './github.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GithubService', () => {
  let config: { get: jest.Mock };
  let service: GithubService;

  beforeEach(() => {
    config = { get: jest.fn() };
    service = new GithubService(config as unknown as ConfigService);
    jest.clearAllMocks();
  });

  it('resolveToken reads GITHUB_TOKEN', () => {
    config.get.mockReturnValue('ghp_x');
    expect(service.resolveToken()).toBe('ghp_x');
  });

  it('fetchRepoSnapshot returns null without token', async () => {
    config.get.mockReturnValue(null);
    await expect(
      service.fetchRepoSnapshot('o', 'r'),
    ).resolves.toBeNull();
  });

  it('fetchRepoSnapshot maps responses', async () => {
    config.get.mockReturnValue('token');
    const recent = new Date().toISOString();
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            sha: 'abcdef1234567890',
            commit: {
              message: 'hello\nmore',
              author: { date: recent, name: 'Dev' },
            },
            html_url: 'https://c',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            number: 1,
            title: 'PR',
            state: 'open',
            merged_at: null,
            html_url: 'https://p',
            user: { login: 'u' },
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [{ login: 'c1', contributions: 3, avatar_url: 'a' }],
      });
    mockedAxios.create.mockReturnValue({ get } as never);

      const snap = await service.fetchRepoSnapshot('o', 'r');
      expect(snap).not.toBeNull();
      expect(snap!.recentCommits[0].sha).toHaveLength(7);
      expect(snap!.recentCommits[0].message).toBe('hello');
      expect(snap!.recentCommits[0].author).toBe('Dev');
    expect(snap!.pullRequests[0].state).toBe('open');
    expect(snap!.contributors[0].login).toBe('c1');
    expect(snap!.commitsLast7Days).toBeGreaterThanOrEqual(1);
  });

  it('uses unknown author when name missing', async () => {
    config.get.mockReturnValue('token');
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            sha: 'abcdef1234567890',
            commit: {
              message: 'm',
              author: { date: '' } as { date: string; name?: string },
            },
            html_url: 'u',
          },
        ],
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });
    mockedAxios.create.mockReturnValue({ get } as never);
    const snap = await service.fetchRepoSnapshot('o', 'r');
    expect(snap!.recentCommits[0].author).toBe('unknown');
  });

  it('maps merged pull requests', async () => {
    config.get.mockReturnValue('token');
    const recent = new Date().toISOString();
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            sha: 'abcdef1234567890',
            commit: { message: 'm', author: { date: recent, name: 'D' } },
            html_url: 'u',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            number: 2,
            title: 'Merged',
            state: 'closed',
            merged_at: recent,
            html_url: 'u2',
            user: { login: 'u' },
          },
        ],
      })
      .mockResolvedValueOnce({ data: [] });
    mockedAxios.create.mockReturnValue({ get } as never);
    const snap = await service.fetchRepoSnapshot('o', 'r');
    expect(snap!.pullRequests[0].state).toBe('merged');
  });

  it('fetchRepoSnapshot returns null on error', async () => {
    config.get.mockReturnValue('token');
    mockedAxios.create.mockReturnValue({
      get: jest.fn().mockRejectedValue(new Error('rate limit')),
    } as never);
    await expect(service.fetchRepoSnapshot('o', 'r')).resolves.toBeNull();
  });
});
