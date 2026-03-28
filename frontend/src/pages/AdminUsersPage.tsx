// AI assisted development
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  memberships: { projectId: string }[];
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<AdminUserRow[]>('/users');
        setUsers(data);
      } catch {
        setError('Unable to load users (admin only).');
      }
    })();
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Team & access</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
        Internal admins and client viewers. Assign projects via API or Prisma
        Studio for now.
      </p>
      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Projects</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name ?? u.email}</div>
                  <div className="text-xs text-zinc-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">{u.role}</td>
                <td className="px-4 py-3">
                  {u.memberships.length === 0
                    ? '—'
                    : u.memberships.map((m) => m.projectId).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
