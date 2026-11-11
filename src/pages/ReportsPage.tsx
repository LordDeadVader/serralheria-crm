import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '../components/StatusBadge';
import { Empty, ErrorBox, PageHeader, Panel, Spinner, TableWrap } from '../components/ui';
import { formatBRL, formatPct, roundPct } from '../calculations/money';
import { dashboardRepo } from '../repositories';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;

export function ReportsPage() {
  const d = useQuery({ queryKey: ['dashboard'], queryFn: dashboardRepo.get });
  if (d.isLoading) return <Spinner />;
  if (d.error || !d.data) return <ErrorBox error={d.error} onRetry={() => d.refetch()} />;
  const { monthly, byStatus } = d.data;
  const max = Math.max(1, ...monthly.map((m) => m.quotedTotal));
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Desempenho comercial mensal (últimos 12 meses com movimento)." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <TableWrap>
            {monthly.length === 0 ? (
              <Empty title="Sem orçamentos para gerar relatórios" />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th className="text-right">Criados</th>
                    <th className="text-right">Orçado</th>
                    <th className="text-right">Aprovados</th>
                    <th className="text-right">Faturamento aprovado</th>
                    <th className="hidden text-right sm:table-cell">Margem bruta*</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month}>
                      <td className="whitespace-nowrap">{monthLabel(m.month)}</td>
                      <td className="num text-right">{m.created}</td>
                      <td className="num text-right">
                        {formatBRL(m.quotedTotal)}
                        <div className="ml-auto mt-1 h-1 rounded bg-gray-100" style={{ width: 96 }}>
                          <div className="h-1 rounded bg-brand-500" style={{ width: `${(m.quotedTotal / max) * 100}%` }} />
                        </div>
                      </td>
                      <td className="num text-right">
                        {m.approved} <span className="text-xs text-gray-500">({m.created ? Math.round((m.approved / m.created) * 100) : 0}%)</span>
                      </td>
                      <td className="num text-right font-medium">{formatBRL(m.approvedTotal)}</td>
                      <td className="num hidden text-right sm:table-cell">{m.approvedTotal ? formatPct(roundPct(((m.approvedTotal - m.approvedCost) / m.approvedTotal) * 100)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableWrap>
          <p className="mt-2 text-xs text-gray-500">* (valor aprovado − custo total) ÷ valor aprovado, antes de impostos, taxas e comissões. Agrupado pelo mês de criação do orçamento.</p>
        </div>
        <Panel title="Por status" bodyClass="p-0">
          <ul className="divide-y divide-gray-100">
            {byStatus.map((s) => (
              <li key={s.status} className="flex items-center justify-between px-4 py-2 text-sm">
                <StatusBadge status={s.status} />
                <span className="num">
                  {s.n} · {formatBRL(s.total)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
