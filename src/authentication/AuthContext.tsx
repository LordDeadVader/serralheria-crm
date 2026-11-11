import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authRepo } from '../repositories';
import { session, setUnauthorizedHandler } from '../services/api';
import type { Company, User } from '../types/domain';

interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated';
  user: User | null;
  company: Company | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (d: { inviteCode: string; companyName: string; name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<AuthState['status']>(session.get() ? 'loading' : 'anonymous');
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const reset = useCallback(() => {
    setUser(null);
    setCompany(null);
    setStatus('anonymous');
    qc.clear();
  }, [qc]);

  const refresh = useCallback(async () => {
    if (!session.get()) return reset();
    try {
      const me = await authRepo.me();
      setUser(me.user);
      setCompany(me.company);
      setStatus('authenticated');
    } catch (e) {
      if ((e as { status?: number }).status === 401) reset();
      else setStatus((s) => (s === 'loading' ? 'anonymous' : s));
    }
  }, [reset]);

  useEffect(() => {
    setUnauthorizedHandler(reset);
    void refresh();
  }, [refresh, reset]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      company,
      refresh,
      login: async (email, password) => {
        const r = await authRepo.login(email, password);
        session.set(r.token);
        await refresh();
      },
      signup: async (d) => {
        const r = await authRepo.signup(d);
        session.set(r.token);
        await refresh();
      },
      logout: async () => {
        try {
          await authRepo.logout();
        } catch {
          /* sessão já inválida */
        }
        session.clear();
        reset();
      },
    }),
    [status, user, company, refresh, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
