import { useState, type FormEvent } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useAuth } from '../authentication/AuthContext';
import { Button, Input } from '../components/ui';
import { useForm } from '../hooks/useForm';
import { useInstall } from '../hooks/useInstall';
import { loginSchema } from '../schemas/entities';

const BASE = import.meta.env.BASE_URL;

/** Acesso exclusivo da WJR Serralheria. Não há cadastro público: contas são criadas pelo administrador. */
export function LoginPage() {
  const { login } = useAuth();
  const inst = useInstall();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const f = useForm({ email: '', password: '' });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!f.validate(loginSchema)) return;
    setBusy(true);
    try {
      await login(f.values.email, f.values.password);
    } catch (err) {
      f.applyApiError(err);
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between bg-[#101112] p-10 text-white md:flex lg:p-14">
        <img src={`${BASE}logo-white.webp`} alt="WJR" className="h-16 w-auto self-start" />
        <div>
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Área restrita</p>
          <h1 className="max-w-md text-4xl leading-[1.05] font-semibold tracking-tight lg:text-5xl">Gestão da WJR Serralheria</h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
            Clientes, orçamentos, materiais, estoque, produção e o conteúdo do site em um só lugar.
          </p>
        </div>
        <a href="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="size-4" /> Voltar ao site
        </a>
      </aside>

      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <img src={`${BASE}logo.webp`} alt="WJR" className="h-12 w-auto" />
            <div>
              <p className="text-base font-semibold text-gray-900">WJR Gestão</p>
              <p className="text-xs text-gray-500">Área restrita</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Entrar</h2>
          <p className="mt-1 mb-6 text-sm text-gray-500">Use o e-mail e a senha da sua conta.</p>
          <form className="space-y-4" onSubmit={submit} noValidate>
            <Input label="E-mail" type="email" value={f.values.email} onChange={(e) => f.set('email', e.target.value)} error={f.errors.email} autoComplete="username" />
            <Input
              label="Senha"
              type="password"
              value={f.values.password}
              onChange={(e) => f.set('password', e.target.value)}
              error={f.errors.password}
              autoComplete="current-password"
            />
            {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={busy}>
              Entrar
            </Button>
          </form>
          <p className="mt-5 text-xs leading-relaxed text-gray-500">
            Acesso exclusivo da equipe WJR. Esqueceu a senha? Peça a redefinição ao administrador; depois de entrar, você pode trocá-la em Configurações.
          </p>
          {!inst.installed && (inst.canPrompt || inst.ios) && (
            <div className="mt-8 border-t border-gray-200 pt-5">
              {inst.canPrompt ? (
                <Button icon={<Download className="size-4" />} onClick={() => void inst.install()} className="w-full">
                  Instalar como aplicativo
                </Button>
              ) : (
                <p className="text-xs text-gray-500">
                  <strong className="text-gray-700">Instalar no iPhone:</strong> toque em Compartilhar e depois em “Adicionar à Tela de Início”.
                </p>
              )}
            </div>
          )}
          <a href="/" className="mt-8 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 md:hidden">
            <ArrowLeft className="size-4" /> Voltar ao site
          </a>
        </div>
      </main>
    </div>
  );
}
