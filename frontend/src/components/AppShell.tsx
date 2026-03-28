// AI assisted development
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useEffect, useState } from 'react';
import { api, type NotificationRow } from '../lib/api';
import clsx from 'clsx';

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    (async () => {
      try {
        const { data } = await api.get<NotificationRow[]>('/notifications');
        setNotifications(data);
      } catch {
        /* ignore */
      }
    })();
  }, [user]);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="font-semibold tracking-tight text-indigo-600 dark:text-indigo-400">
            Transparency
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                clsx(
                  'px-3 py-1.5 rounded-lg',
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-900 font-medium'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900',
                )
              }
              end
            >
              Projects
            </NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  clsx(
                    'px-3 py-1.5 rounded-lg',
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 font-medium'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900',
                  )
                }
              >
                Team
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                Alerts
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center px-1">
                    {unread}
                  </span>
                )}
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-80 max-h-80 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-2 text-xs">
                  {notifications.length === 0 ? (
                    <p className="text-zinc-500 p-2">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <p className="font-medium">{n.title}</p>
                        <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {n.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toggle}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <span className="hidden sm:inline text-xs text-zinc-500 truncate max-w-[140px]">
              {user?.name ?? user?.email}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
