import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { ClientFormModal } from '../components/ClientFormModal';
import { useFeedback } from '../components/feedback';
import { Button, Empty, ErrorBox, PageHeader, SearchInput, Segmented, Spinner, TableWrap } from '../components/ui';
import { formatBRL } from '../calculations/money';
import { clientsRepo } from '../repositories';
import type { Client } from '../types/domain';

export function ClientsPage() {
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState<'ativos' | 'arquivados'>('ativos');
  const [editing, setEditing] = useState<Client | null | undefined>(undefined);
  const fb = useFeedback();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['clients', q, archived], queryFn: () => clientsRepo.list(q, archived === 'arquivados') });

  async function act(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['clients'] });
      fb.ok(msg);
    } catch (e) {
      fb.error(e);
    }
  }

  async function remove(c: Client) {
    const yes = await fb.confirm({
      title: 'Excluir cliente',
      message: `Excluir "${c.name}" definitivamente? Clientes com orçamentos não podem ser excluídos — use Arquivar.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (yes) await act(() => clientsRepo.remove(c.id), 'Cliente excluído.');
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro, histórico de orçamentos e valores negociados."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
            Novo cliente
          </Button>
        }
      />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={q} onChange={setQ} placeholder="Nome, documento, telefone, cidade…" />
        <Segmented value={archived} onChange={setArchived} options={[{ value: 'ativos', label: 'Ativos' }, { value: 'arquivados', label: 'Arquivados' }]} />
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <TableWrap>
          <Empty title={q ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'} action={!q && <Button variant="primary" onClick={() => setEditing(null)}>Cadastrar cliente</Button>}>
            {!q && 'Cadastre seus clientes para vincular orçamentos e acompanhar negociações.'}
          </Empty>
        </TableWrap>
      ) : (
        <TableWrap>
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th>Nome</th>
                <th className="md:hidden lg:table-cell">Documento</th>
                <th>Contato</th>
                <th className="md:hidden lg:table-cell">Cidade</th>
                <th className="text-right">Orçamentos</th>
                <th className="text-right">Aprovado</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((c) => (
                <tr key={c.id}>
                  <td className="c-main">
                    <Link to={`/clientes/${c.id}`} className="font-medium text-gray-900 hover:text-brand-700 hover:underline">
                      {c.name}
                    </Link>
                    <span className="ml-2 text-xs text-gray-400">{c.personType}</span>
                  </td>
                  <td className="text-gray-600 md:hidden lg:table-cell">{c.document || '—'}</td>
                  <td className="text-gray-600">{c.whatsapp || c.phone || c.email || '—'}</td>
                  <td className="text-gray-600 md:hidden lg:table-cell">{[c.city, c.state].filter(Boolean).join('/') || '—'}</td>
                  <td className="num text-right">{c.quoteCount ?? 0}</td>
                  <td className="num text-right">{formatBRL(c.approvedTotal)}</td>
                  <td className="c-actions">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditing(c)} icon={<Pencil className="size-3.5" />} />
                      {archived === 'ativos' ? (
                        <Button size="sm" variant="ghost" title="Arquivar" onClick={() => act(() => clientsRepo.archive(c.id), 'Cliente arquivado.')} icon={<Archive className="size-3.5" />} />
                      ) : (
                        <Button size="sm" variant="ghost" title="Restaurar" onClick={() => act(() => clientsRepo.unarchive(c.id), 'Cliente restaurado.')} icon={<ArchiveRestore className="size-3.5" />} />
                      )}
                      <Button size="sm" variant="ghost" title="Excluir" onClick={() => remove(c)} icon={<Trash2 className="size-3.5 text-red-600" />} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <ClientFormModal open={editing !== undefined} client={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}
