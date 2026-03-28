// AI assisted development
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export type GithubCommitView = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

export type GithubPrView = {
  number: number;
  title: string;
  state: string;
  mergedAt: string | null;
  htmlUrl: string;
  author: string;
};

export type GithubContributorView = {
  login: string;
  contributions: number;
  avatarUrl: string;
};

export type GithubSnapshot = {
  recentCommits: GithubCommitView[];
  pullRequests: GithubPrView[];
  contributors: GithubContributorView[];
  commitsLast7Days: number;
};

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(private readonly config: ConfigService) {}

  private client(token: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 25_000,
    });
  }

  resolveToken(): string | null {
    return this.config.get<string>('GITHUB_TOKEN') ?? null;
  }

  async fetchRepoSnapshot(
    owner: string,
    repo: string,
  ): Promise<GithubSnapshot | null> {
    const token = this.resolveToken();
    if (!token) {
      return null;
    }
    const api = this.client(token);
    const since = new Date();
    since.setDate(since.getDate() - 7);
    try {
      const [commitsRes, prsRes, contribRes] = await Promise.all([
        api.get<
          {
            sha: string;
            commit: { message: string; author: { date: string; name: string } };
            html_url: string;
          }[]
        >(`/repos/${owner}/${repo}/commits`, { params: { per_page: 15 } }),
        api.get<
          {
            number: number;
            title: string;
            state: string;
            merged_at: string | null;
            html_url: string;
            user: { login: string };
          }[]
        >(`/repos/${owner}/${repo}/pulls`, {
          params: { state: 'all', per_page: 20, sort: 'updated' },
        }),
        api.get<{ login: string; contributions: number; avatar_url: string }[]>(
          `/repos/${owner}/${repo}/contributors`,
          { params: { per_page: 10 } },
        ),
      ]);
      const recentCommits: GithubCommitView[] = (commitsRes.data ?? []).map(
        (c) => ({
          sha: c.sha.slice(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.commit.author?.name ?? 'unknown',
          date: c.commit.author?.date ?? '',
          url: c.html_url,
        }),
      );
      let commitsLast7Days = 0;
      for (const c of commitsRes.data ?? []) {
        const d = new Date(c.commit.author?.date ?? 0).getTime();
        if (d >= since.getTime()) {
          commitsLast7Days += 1;
        }
      }
      const pullRequests: GithubPrView[] = (prsRes.data ?? []).map((p) => ({
        number: p.number,
        title: p.title,
        state: p.merged_at ? 'merged' : p.state,
        mergedAt: p.merged_at,
        htmlUrl: p.html_url,
        author: p.user?.login ?? '',
      }));
      const contributors: GithubContributorView[] = (contribRes.data ?? []).map(
        (u) => ({
          login: u.login,
          contributions: u.contributions,
          avatarUrl: u.avatar_url,
        }),
      );
      return {
        recentCommits,
        pullRequests,
        contributors,
        commitsLast7Days,
      };
    } catch (e) {
      this.logger.error(
        `GitHub fetch failed for ${owner}/${repo}: ${(e as Error).message}`,
      );
      return null;
    }
  }
}
