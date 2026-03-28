// AI assisted development
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type AuthUser } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('Missing token');
      return;
    }
    (async () => {
      try {
        api.defaults.headers.Authorization = `Bearer ${token}`;
        const { data } = await api.get<AuthUser>('/auth/me');
        delete api.defaults.headers.Authorization;
        setSession(token, data);
        navigate('/', { replace: true });
      } catch {
        delete api.defaults.headers.Authorization;
        setError('Could not complete sign-in.');
      }
    })();
  }, [params, navigate, setSession]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-zinc-500">
      Completing sign-in…
    </div>
  );
}
