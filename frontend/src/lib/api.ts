// AI assisted development
import axios from 'axios';

/** Public API origin for OAuth links and axios (GitHub Pages needs VITE_API_URL). */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv;
  }
  if (import.meta.env.DEV) {
    return '/api';
  }
  return '';
}

const resolvedBase = getApiBaseUrl();

export const api = axios.create({
  baseURL: resolvedBase || undefined,
});

api.interceptors.request.use((config) => {
  if (!getApiBaseUrl() && !import.meta.env.DEV) {
    return Promise.reject(
      new Error(
        'API URL is not configured. Set the VITE_API_URL GitHub Actions secret to your deployed API (e.g. https://api.example.com/api).',
      ),
    );
  }
  const token = localStorage.getItem('td_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type UserRole = 'ADMIN' | 'CLIENT';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  name?: string | null;
};

export type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  targetEndDate: string | null;
  plannerPlanId: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  _count?: { members: number };
};

export type DashboardPayload = {
  project: {
    id: string;
    name: string;
    description: string | null;
    startDate: string | null;
    targetEndDate: string | null;
  };
  planner: {
    planTitle: string;
    progressPercent: number;
    completedCount: number;
    activeCount: number;
    totalCount: number;
    buckets: { id: string; name: string }[];
    tasks: {
      id: string;
      title: string;
      status: string;
      dueDateTime: string | null;
    }[];
    completionTrend: { date: string; completedDelta: number }[];
    overdueCount: number;
    stuckInProgressCount: number;
  } | null;
  github: {
    recentCommits: {
      sha: string;
      message: string;
      author: string;
      date: string;
      url: string;
    }[];
    pullRequests: {
      number: number;
      title: string;
      state: string;
      mergedAt: string | null;
      htmlUrl: string;
      author: string;
    }[];
    contributors: { login: string; contributions: number; avatarUrl: string }[];
    commitsLast7Days: number;
  } | null;
  risk: {
    level: string;
    score: number;
    factors: { code: string; message: string; weight: number }[];
  };
  timeline: {
    id: string;
    label: string;
    date: string;
    type: string;
    delayed?: boolean;
  }[];
  weeklySummary: string;
};

export type RiskHistoryRow = {
  id: string;
  level: string;
  score: number;
  factors: unknown;
  createdAt: string;
};

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  projectId: string | null;
};
