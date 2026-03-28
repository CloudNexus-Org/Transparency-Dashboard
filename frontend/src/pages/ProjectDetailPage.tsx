// AI assisted development
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { format } from 'date-fns';
import { api, type DashboardPayload, type RiskHistoryRow } from '../lib/api';
import { useAuth } from '../context/AuthContext';

function riskBadgeClass(level: string) {
  if (level === 'HIGH') {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200';
  }
  if (level === 'MEDIUM') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  }
  return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200';
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isClient = user?.role === 'CLIENT';
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [history, setHistory] = useState<RiskHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    (async () => {
      try {
        const [dash, hist] = await Promise.all([
          api.get<DashboardPayload>(`/projects/${id}/dashboard`),
          api.get<RiskHistoryRow[]>(`/projects/${id}/risk-history`),
        ]);
        setData(dash.data);
        setHistory(hist.data);
      } catch {
        setError('Unable to load project dashboard.');
      }
    })();
  }, [id]);

  async function download(kind: 'csv' | 'pdf') {
    if (!id) {
      return;
    }
    const res = await api.get(`/projects/${id}/export/${kind}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-${id}.${kind === 'csv' ? 'csv' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  const statusCounts = data.planner
    ? [
        {
          name: 'Not started',
          count: data.planner.tasks.filter((t) => t.status === 'Not Started')
            .length,
        },
        {
          name: 'In progress',
          count: data.planner.tasks.filter((t) => t.status === 'In Progress')
            .length,
        },
        {
          name: 'Done',
          count: data.planner.tasks.filter((t) => t.status === 'Completed')
            .length,
        },
      ]
    : [];

  const trendData = (data.planner?.completionTrend ?? []).map((t) => ({
    ...t,
    label: t.date,
  }));

  const histChart = [...history]
    .reverse()
    .map((h) => ({
      at: format(new Date(h.createdAt), 'MMM d'),
      score: h.score,
    }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.project.name}
          </h1>
          {data.project.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl">
              {data.project.description}
            </p>
          )}
        </div>
        {!isClient && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => download('csv')}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => download('pdf')}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              Export PDF
            </button>
          </div>
        )}
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Progress
          </p>
          <p className="mt-2 text-3xl font-semibold">
            {data.planner?.progressPercent ?? 0}%
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {data.planner?.completedCount ?? 0} of{' '}
            {data.planner?.totalCount ?? 0} tasks complete
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Risk score
          </p>
          <p className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${riskBadgeClass(data.risk.level)}`}
            >
              {data.risk.level}
            </span>
            <span className="text-2xl font-semibold">{data.risk.score}</span>
            <span className="text-xs text-zinc-500">/ 100</span>
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {data.planner?.overdueCount ?? 0} overdue ·{' '}
            {data.planner?.stuckInProgressCount ?? 0} long-running in progress
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Dev activity (7d)
          </p>
          <p className="mt-2 text-3xl font-semibold">
            {data.github?.commitsLast7Days ?? 0}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Commits in linked repo</p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-5">
        <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
          Weekly client summary
        </h2>
        <p className="mt-2 text-sm text-indigo-950/90 dark:text-indigo-100/90 leading-relaxed">
          {data.weeklySummary}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {data.planner && trendData.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 h-72">
            <h3 className="text-sm font-medium mb-2">Task completion trend</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="completedDelta"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.planner && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 h-72">
            <h3 className="text-sm font-medium mb-2">Tasks by status</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {histChart.length > 1 && !isClient && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 h-64">
          <h3 className="text-sm font-medium mb-2">Risk score history</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={histChart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="at" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#f97316"
                strokeWidth={2}
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold">Delivery timeline</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {data.timeline.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2"
            >
              <span
                className={
                  item.delayed
                    ? 'text-rose-600 dark:text-rose-400 font-medium'
                    : ''
                }
              >
                {item.label}
                {item.delayed && ' · delayed'}
              </span>
              <span className="text-xs text-zinc-500">
                {format(new Date(item.date), 'MMM d, yyyy')}
              </span>
            </li>
          ))}
          {data.timeline.length === 0 && (
            <li className="text-zinc-500">No milestone dates yet.</li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold">Active risks</h3>
        <ul className="mt-3 space-y-2">
          {data.risk.factors.map((f) => (
            <li
              key={f.code}
              className="text-sm text-zinc-700 dark:text-zinc-300 flex gap-2"
            >
              <span className="text-zinc-400">•</span>
              <span>{f.message}</span>
            </li>
          ))}
          {data.risk.factors.length === 0 && (
            <li className="text-sm text-zinc-500">No risks flagged.</li>
          )}
        </ul>
      </section>

      {data.github && !isClient && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold">Recent commits</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {data.github.recentCommits.map((c) => (
                <li key={c.sha}>
                  <a
                    href={c.url}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="font-mono text-xs">{c.sha}</span>{' '}
                    {c.message}
                  </a>
                  <p className="text-xs text-zinc-500">
                    {c.author} ·{' '}
                    {c.date
                      ? format(new Date(c.date), 'MMM d, HH:mm')
                      : ''}
                  </p>
                </li>
              ))}
              {data.github.recentCommits.length === 0 && (
                <li className="text-zinc-500">No commits loaded.</li>
              )}
            </ul>
          </section>
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold">Pull requests</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {data.github.pullRequests.map((p) => (
                <li key={p.number}>
                  <a
                    href={p.htmlUrl}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{p.number} {p.title}
                  </a>
                  <p className="text-xs text-zinc-500">
                    {p.state} · {p.author}
                  </p>
                </li>
              ))}
              {data.github.pullRequests.length === 0 && (
                <li className="text-zinc-500">No pull requests loaded.</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
