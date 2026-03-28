// AI assisted development
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ProjectRow } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<ProjectRow[]>('/projects');
        setProjects(data);
      } catch {
        setError('Could not load projects.');
      }
    })();
  }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {user?.role === 'CLIENT'
              ? 'Projects shared with your organization.'
              : 'All active engagements.'}
          </p>
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              to={`/projects/${p.id}`}
              className="block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-sm"
            >
              <h2 className="font-medium text-lg">{p.name}</h2>
              {p.description && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-2">
                  {p.description}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                <div>
                  <dt className="font-medium text-zinc-400">Start</dt>
                  <dd>
                    {p.startDate
                      ? format(new Date(p.startDate), 'MMM d, yyyy')
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-400">Target</dt>
                  <dd>
                    {p.targetEndDate
                      ? format(new Date(p.targetEndDate), 'MMM d, yyyy')
                      : '—'}
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
      {projects.length === 0 && !error && (
        <p className="mt-8 text-sm text-zinc-500">No projects yet.</p>
      )}
    </div>
  );
}
