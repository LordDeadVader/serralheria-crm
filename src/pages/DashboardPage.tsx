import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '../authentication/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { Button, Empty, ErrorBox, PageHeader, Panel, Spinner, Stat } from '../components/ui';
import { formatBRL } from '../calculations/money';
import { formatDate, todayIso } from '../lib/format';
import { dashboardRepo } from '../repositories';

const OPEN = ['rascunho', 'em_elaboracao', 'enviado', 'em_negociacao'];
const WON = ['aprovado', 'em_producao', 'concluido'];

export function DashboardPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const d = useQuery({ queryKey: ['dashboard'], queryFn: dashboardRepo.get });
  if (d.isLoading) return <Spinner />;
  if (d.error || !d.data) return <ErrorBox error={d.error} onRetry={() => d.refetch()} />;
  const { byStatus, counts, recent, followups, monthly } = d.data;
  const sum = (list: string[], f: 'n' | 'total') => byStatus.filter((s) => list.includes(s.status)).reduce((a, b) => a + b[f], 0);
  const decided = sum([...WON, 'reprovado'], 'n');
  const conv = decided ? Math.round((sum(WON, 'n') / decided) * 100) : null;
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = monthly.find((m) => m.month === month);
  const today = todayIso();
  const firstRun = (counts?.clients ?? 0) === 0 && recent.length === 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Olá, ${user?.name?.split(' ')[0] ?? ''}. Visão geral dos orçamentos.`}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => nav('/orcamentos/novo')}>
            Novo orçamento
          </Button>
        }
      />
      {firstRun && (
        <Panel className="mb-4" title="Primeiros passos">
          <ol className="grid gap-3 text-sm sm:grid-cols-4">
            {[
              ['1. Dados da empresa', 'Logotipo, CNPJ e contatos para a proposta.', '/configuracoes'],
              ['2. Materiais', 'Revise os exemplos e cadastre seus preços reais.', '/materiais'],
              ['3. Clientes', 'Cadastre o primeiro cliente.', '/clientes'],
              ['4. Orçamento', 'Monte o orçamento e gere o PDF.', '/orcamentos/novo'],
            ].map(([t, s, to]) => (
              <li key={t}>
                <Link to={to} className="block rounded-md border border-gray-200 p-3 hover:border-brand-200 hover:bg-brand-50/40">
                  <p className="font-medium text-gray-900">{t}</p>
                  <p className="text-gray-500">{s}</p>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      )}
      {(counts?.lowStock ?? 0) + (counts?.outOfStock ?? 0) > 0 && (
        <Link to="/estoque" className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100/60">
          <span>
            <strong>Estoque:</strong> {counts?.outOfStock ? `${counts.outOfStock} item(ns) zerado(s)` : ''}
            {counts?.outOfStock && counts?.lowStock ? ' e ' : ''}
            {counts?.lowStock ? `${counts.lowStock} abaixo do mínimo` : ''}.
          </span>
          <span className="shrink-0 font-medium">Ver o que repor →</span>
        </Link>
      )}
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 lg:grid-cols-5">
        {[
          <Stat key="a" label="Em aberto" value={formatBRL(sum(OPEN, 'total'))} sub={`${sum(OPEN, 'n')} orçamento(s)`} />,
          <Stat key="b" label="Aprovados (total)" value={formatBRL(sum(WON, 'total'))} sub={`${sum(WON, 'n')} orçamento(s)`} />,
          <Stat key="c" label="Aprovados no mês" value={formatBRL(thisMonth?.approvedTotal ?? 0)} sub={`${thisMonth?.approved ?? 0} de ${thisMonth?.created ?? 0} criados`} />,
          <Stat key="d" label="Taxa de conversão" value={conv == null ? '—' : `${conv}%`} sub="aprovados ÷ decididos" />,
          <Stat key="e" label="Cadastros" value={`${counts?.clients ?? 0} clientes`} sub={`${counts?.materials ?? 0} materiais · ${counts?.services ?? 0} serviços`} />,
        ].map((s, i) => (
          <div key={i} className="bg-white p-4">
            {s}
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Orçamentos recentes" className="lg:col-span-2" bodyClass="p-0" actions={<Link to="/orcamentos" className="text-xs font-medium text-brand-700 hover:underline">Ver todos</Link>}>
          {recent.length === 0 ? (
            <Empty title="Nenhum orçamento ainda" action={<Button onClick={() => nav('/orcamentos/novo')}>Criar o primeiro</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl tbl-cards">
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td className="c-main whitespace-nowrap">
                        <Link className="font-medium text-brand-700 hover:underline" to={`/orcamentos/${r.id}`}>
                          {r.code}
                        </Link>
                      </td>
                      <td className="max-md:order-1 max-md:!w-auto max-md:flex-1 max-md:!justify-start max-md:!text-left">
                        <div className="min-w-0">
                          <p className="font-medium">{r.clientName}</p>
                          <p className="text-xs text-gray-500">{r.title}</p>
                        </div>
                      </td>
                      <td className="c-side">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="num text-right font-medium max-md:order-2 max-md:!w-auto">{formatBRL(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="min-w-0 space-y-4">
          <Panel title="Retornos (próximos 7 dias)" bodyClass="p-0">
            {followups.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhum retorno agendado.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {followups.map((r) => (
                  <li key={r.id}>
                    <Link to={`/orcamentos/${r.id}`} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50">
                      <span>
                        <span className="font-medium">{r.clientName}</span>
                        <span className="block text-xs text-gray-500">{r.code}</span>
                      </span>
                      <span className={r.nextFollowupAt! < today ? 'text-xs font-semibold text-red-700' : 'text-xs text-gray-600'}>{formatDate(r.nextFollowupAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Funil por status" bodyClass="p-0">
            <ul className="divide-y divide-gray-100">
              {byStatus.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Sem dados.</li>}
              {byStatus.map((s) => (
                <li key={s.status} className="flex items-center justify-between px-4 py-2 text-sm">
                  <StatusBadge status={s.status} />
                  <span className="num text-gray-700">
                    {s.n} · {formatBRL(s.total)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
