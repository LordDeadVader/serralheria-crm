import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns3, List, Plus } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useFeedback } from '../components/feedback';
import { Button, Empty, ErrorBox, PageHeader, SearchInput, Segmented, Select, Spinner, TableWrap, cx } from '../components/ui';
import { formatBRL } from '../calculations/money';
import { formatDate, todayIso } from '../lib/format';
import { quotesRepo } from '../repositories';
import { QUOTE_STATUSES, STATUS_LABEL, type QuoteStatus, type QuoteSummary } from '../types/domain';

export function QuotesPage() {
  const nav = useNavigate();
  const [view, setView] = useState<'tabela' | 'kanban'>(() => {
    try {
      return (localStorage.getItem('scrm.quotes-view') as 'tabela' | 'kanban') || 'tabela';
    } catch {
      return 'tabela';
    }
  });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const list = useQuery({ queryKey: ['quotes', 'list', q, status], queryFn: () => quotesRepo.list({ q, status }) });

  const changeView = (v: 'tabela' | 'kanban') => {
    setView(v);
    try {
      localStorage.setItem('scrm.quotes-view', v);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <PageHeader
        title="Orçamentos"
        subtitle="Propostas, versões e acompanhamento comercial."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => nav('/orcamentos/novo')}>
            Novo orçamento
          </Button>
        }
      />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={q} onChange={setQ} placeholder="Número, projeto ou cliente…" />
          {view === 'tabela' && (
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" aria-label="Filtrar por status">
              <option value="">Todos os status</option>
              {QUOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
        </div>
        <Segmented
          value={view}
          onChange={changeView}
          options={[
            { value: 'tabela', label: <><List className="size-3.5" /> Tabela</> },
            { value: 'kanban', label: <><Columns3 className="size-3.5" /> Kanban</> },
          ]}
        />
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <TableWrap>
          <Empty title="Nenhum orçamento encontrado" action={<Button variant="primary" onClick={() => nav('/orcamentos/novo')}>Criar orçamento</Button>} />
        </TableWrap>
      ) : view === 'tabela' ? (
        <QuoteTable rows={list.data} />
      ) : (
        <Kanban rows={list.data} statuses={['rascunho', 'em_elaboracao', 'enviado', 'em_negociacao', 'aprovado', 'reprovado']} />
      )}
    </>
  );
}

export function QuoteTable({ rows }: { rows: QuoteSummary[] }) {
  const today = todayIso();
  return (
    <TableWrap>
      <table className="tbl">
        <thead>
          <tr>
            <th>Número</th>
            <th>Cliente / projeto</th>
            <th>Status</th>
            <th className="hidden md:table-cell">Próximo retorno</th>
            <th className="hidden lg:table-cell">Atualizado</th>
            <th className="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap">
                <Link className="font-medium text-brand-700 hover:underline" to={`/orcamentos/${r.id}`}>
                  {r.code}
                </Link>
                <span className="ml-1 text-xs text-gray-400">v{r.currentVersion}</span>
              </td>
              <td>
                <p className="font-medium text-gray-900">{r.clientName}</p>
                <p className="text-xs text-gray-500">{r.title}</p>
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td className={cx('hidden md:table-cell', r.nextFollowupAt && r.nextFollowupAt < today ? 'font-medium text-red-700' : 'text-gray-600')}>{formatDate(r.nextFollowupAt)}</td>
              <td className="hidden text-gray-500 lg:table-cell">{formatDate(r.updatedAt)}</td>
              <td className="num text-right font-medium">{formatBRL(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

export function Kanban({ rows, statuses }: { rows: QuoteSummary[]; statuses: QuoteStatus[] }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);

  async function move(id: string, to: QuoteStatus) {
    const q = rows.find((r) => r.id === id);
    if (!q || q.status === to) return;
    if (to === 'reprovado' || to === 'cancelado') {
      fb.error('Para reprovar ou cancelar, abra o orçamento e informe o motivo da perda.');
      return;
    }
    try {
      await quotesRepo.setStatus(id, to);
      await qc.invalidateQueries({ queryKey: ['quotes'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      fb.ok(`${q.code}: ${STATUS_LABEL[to]}.`);
    } catch (e) {
      fb.error(e);
    }
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {statuses.map((s) => {
          const items = rows.filter((r) => r.status === s);
          return (
            <section
              key={s}
              className="flex w-64 shrink-0 flex-col rounded-lg border border-gray-200 bg-gray-100/60"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragging && void move(dragging, s)}
              aria-label={STATUS_LABEL[s]}
            >
              <header className="flex items-center justify-between px-3 py-2">
                <span className="text-[13px] font-semibold text-gray-800">{STATUS_LABEL[s]}</span>
                <span className="num text-xs text-gray-500">
                  {items.length} · {formatBRL(items.reduce((a, b) => a + b.total, 0))}
                </span>
              </header>
              <div className="flex-1 space-y-2 px-2 pb-2">
                {items.map((r) => (
                  <Link
                    key={r.id}
                    to={`/orcamentos/${r.id}`}
                    draggable
                    onDragStart={() => setDragging(r.id)}
                    onDragEnd={() => setDragging(null)}
                    className="block rounded-md border border-gray-200 bg-white p-2.5 text-sm hover:border-brand-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-brand-700">{r.code}</span>
                      <span className="num text-xs font-semibold">{formatBRL(r.total)}</span>
                    </div>
                    <p className="mt-1 truncate font-medium text-gray-900">{r.clientName}</p>
                    <p className="truncate text-xs text-gray-500">{r.title}</p>
                    {r.nextFollowupAt && <p className="mt-1 text-[11px] text-gray-500">Retorno {formatDate(r.nextFollowupAt)}</p>}
                  </Link>
                ))}
                {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-gray-400">Arraste orçamentos para cá</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
