import { useState, type FormEvent } from 'react';
import { useAuth } from '../authentication/AuthContext';
import { Button, Input, Segmented } from '../components/ui';
import { useForm } from '../hooks/useForm';
import { loginSchema, signupSchema } from '../schemas/entities';

export function LoginPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const f = useForm({ email: '', password: '', inviteCode: '', companyName: '', name: '' });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const data = mode === 'login' ? f.validate(loginSchema) : f.validate(signupSchema);
    if (!data) return;
    setBusy(true);
    try {
      if (mode === 'login') await login(f.values.email, f.values.password);
      else await signup(data as Parameters<typeof signup>[0]);
    } catch (err) {
      f.applyApiError(err);
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md bg-brand-700 text-sm font-bold text-white">SC</div>
          <div>
            <p className="text-base font-semibold text-gray-900">Serralheria CRM</p>
            <p className="text-xs text-gray-500">Clientes, custos e orçamentos</p>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-5">
            <Segmented
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError('');
                f.setErrors({});
              }}
              options={[
                { value: 'login', label: 'Entrar' },
                { value: 'signup', label: 'Criar conta com convite' },
              ]}
            />
          </div>
          <form className="space-y-3.5" onSubmit={submit} noValidate>
            {mode === 'signup' && (
              <>
                <Input
                  label="Código de convite"
                  value={f.values.inviteCode}
                  onChange={(e) => f.set('inviteCode', e.target.value.toUpperCase())}
                  error={f.errors.inviteCode}
                  placeholder="CONV-XXXX-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  hint="Fornecido pelo administrador do sistema. Uso único."
                />
                <Input label="Nome da empresa" value={f.values.companyName} onChange={(e) => f.set('companyName', e.target.value)} error={f.errors.companyName} />
                <Input label="Seu nome" value={f.values.name} onChange={(e) => f.set('name', e.target.value)} error={f.errors.name} autoComplete="name" />
              </>
            )}
            <Input label="E-mail" type="email" value={f.values.email} onChange={(e) => f.set('email', e.target.value)} error={f.errors.email} autoComplete="email" />
            <Input
              label="Senha"
              type="password"
              value={f.values.password}
              onChange={(e) => f.set('password', e.target.value)}
              error={f.errors.password}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              hint={mode === 'signup' ? 'Mínimo de 10 caracteres, com letras e números.' : undefined}
            />
            {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={busy}>
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
          {mode === 'login' && (
            <p className="mt-4 text-xs text-gray-500">
              Esqueceu a senha? Solicite a redefinição ao administrador do sistema. Depois de entrar, você pode trocar a senha em Configurações.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
