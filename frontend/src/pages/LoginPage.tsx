// AI assisted development
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../lib/api';

export function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const oauthError = params.get('error');
  const [email, setEmail] = useState('client@example.com');
  const [password, setPassword] = useState('ChangeMeNow!');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      setError('Sign-in failed. Check your email and password.');
    }
  }

  const apiBase = getApiBaseUrl();
  const msUrl = apiBase ? `${apiBase}/auth/microsoft` : '';

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Transparency Dashboard
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Secure visibility for your IT engagements.
        </p>
        {(error || oauthError) && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {oauthError ? 'Microsoft sign-in was cancelled or failed.' : error}
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Email
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Password
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="mt-6">
          {msUrl ? (
            <a
              href={msUrl}
              className="flex w-full items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Continue with Microsoft
            </a>
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-500">
              Microsoft sign-in needs a deployed API: set the{' '}
              <code className="text-[11px]">VITE_API_URL</code> secret for GitHub
              Actions (see SETUP.md).
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            Microsoft login requires an Entra ID app registration; see{' '}
            <code className="text-[11px]">SETUP.md</code> in the repository root.
          </p>
        </div>
      </div>
    </div>
  );
}
