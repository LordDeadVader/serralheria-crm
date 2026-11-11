import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { ClientFormModal, formatAddress } from '../components/ClientFormModal';
import { StatusBadge } from '../components/StatusBadge';
import { Button, Empty, ErrorBox, PageHeader, Panel, Spinner, Stat } from '../components/ui';
import { formatBRL } from '../calculations/money';
import { clientsRepo } from '../repositories';
import { formatDate } from '../lib/format';

const WON = ['aprovado', 'em_producao', 'concluido'];

/** Número no formato do wa.me (com DDI 55 quando o cadastro tem só DDD + número). */
function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '');
  return d.length <= 11 ? `55${d}` : d;
}

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  const q = useQuery({ queryKey: ['clients', 'detail', id], queryFn: () => clientsRepo.get(id) });
  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;
  const won = c.quotes.filter((x) => WON.includes(x.status));
  const open = c.quotes.filter((x) => ['enviado', 'em_negociacao', 'rascunho', 'em_elaboracao'].includes(x.status));

  return (
    <>
      <Link to="/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <PageHeader
        title={c.name}
        subtitle={[c.personType === 'PF' ? 'Pessoa física' : 'Pessoa jurídica', c.document].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>
              Editar
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => nav(`/orcamentos/novo?cliente=${c.id}`)}>
              Novo orçamento
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Dados de contato">
          <dl className="space-y-2 text-sm">
            {(
              [
                ['Telefone', c.phone, c.phone && `tel:${c.phone.replace(/\D/g, '')}`],
                ['WhatsApp', c.whatsapp, c.whatsapp && `https://wa.me/${waNumber(c.whatsapp)}`],
                ['E-mail', c.email, c.email && `mailto:${c.email}`],
                ['Endereço', formatAddress(c), null],
                ['Observações', c.notes, null],
              ] as Array<[string, string | null | undefined, string | null | undefined | '']>
            ).map(([k, v, href]) => (
              <div key={k}>
                <dt className="text-xs text-gray-500">{k}</dt>
                <dd className="whitespace-pre-line break-words text-gray-900">
                  {v && href ? (
                    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="text-brand-700 hover:underline">
                      {v}
                    </a>
                  ) : (
                    v || '—'
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Panel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Orçamentos" value={c.quotes.length} />
              <Stat label="Em aberto" value={formatBRL(open.reduce((s, x) => s + x.total, 0))} sub={`${open.length} orçamento(s)`} />
              <Stat label="Valor negociado (aprovado)" value={formatBRL(won.reduce((s, x) => s + x.total, 0))} sub={`${won.length} aprovado(s)`} />
              <Stat label="Taxa de aprovação" value={c.quotes.length ? `${Math.round((won.length / c.quotes.length) * 100)}%` : '—'} />
            </div>
          </Panel>
          <Panel title="Histórico de orçamentos" bodyClass="p-0">
            {c.quotes.length === 0 ? (
              <Empty title="Nenhum orçamento para este cliente" />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl tbl-cards">
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Projeto</th>
                      <th>Status</th>
                      <th className="md:hidden lg:table-cell">Atualizado</th>
                      <th className="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.quotes.map((x) => (
                      <tr key={x.id}>
                        <td className="c-main">
                          <Link className="font-medium text-brand-700 hover:underline" to={`/orcamentos/${x.id}`}>
                            {x.code}
                          </Link>
                          <span className="ml-1 text-xs text-gray-400">v{x.currentVersion}</span>
                        </td>
                        <td className="text-gray-700">{x.title}</td>
                        <td className="c-side">
                          <StatusBadge status={x.status} />
                        </td>
                        <td className="text-gray-500 md:hidden lg:table-cell">{formatDate(x.updatedAt)}</td>
                        <td className="num text-right font-medium">{formatBRL(x.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
      <ClientFormModal open={edit} client={c} onClose={() => setEdit(false)} onSaved={() => q.refetch()} />
    </>
  );
}
