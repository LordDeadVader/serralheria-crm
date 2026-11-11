import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useFeedback } from '../components/feedback';
import { Button, Empty, ErrorBox, Input, Modal, PageHeader, SearchInput, Spinner, TableWrap, Textarea } from '../components/ui';
import { useForm } from '../hooks/useForm';
import { suppliersRepo } from '../repositories';
import { supplierSchema, type SupplierInput } from '../schemas/entities';
import type { Supplier } from '../types/domain';

const EMPTY: SupplierInput = { name: '', document: '', phone: '', email: '', contact: '', notes: '' };

export function SuppliersPage() {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Supplier | null | undefined>(undefined);
  const fb = useFeedback();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['suppliers', q], queryFn: () => suppliersRepo.list(q) });

  async function remove(s: Supplier) {
    if (!(await fb.confirm({ title: 'Remover fornecedor', message: `Remover "${s.name}"? Se houver materiais vinculados, ele será arquivado.`, confirmLabel: 'Remover', danger: true }))) return;
    try {
      const r = await suppliersRepo.remove(s.id);
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      fb.ok(r.archived ? 'Fornecedor arquivado (possui materiais vinculados).' : 'Fornecedor excluído.');
    } catch (e) {
      fb.error(e);
    }
  }

  return (
    <>
      <PageHeader
        title="Fornecedores"
        subtitle="Vincule fornecedores aos materiais para saber onde comprar."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
            Novo fornecedor
          </Button>
        }
      />
      <div className="mb-3">
        <SearchInput value={q} onChange={setQ} />
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <TableWrap>
          <Empty title="Nenhum fornecedor cadastrado" />
        </TableWrap>
      ) : (
        <TableWrap>
          <table className="tbl">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th className="hidden md:table-cell">Contato</th>
                <th className="hidden sm:table-cell">Telefone</th>
                <th className="hidden lg:table-cell">E-mail</th>
                <th className="text-right">Materiais</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="hidden text-gray-600 md:table-cell">{s.contact || '—'}</td>
                  <td className="hidden text-gray-600 sm:table-cell">{s.phone || '—'}</td>
                  <td className="hidden text-gray-600 lg:table-cell">{s.email || '—'}</td>
                  <td className="num text-right">{s.materialCount}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditing(s)} icon={<Pencil className="size-3.5" />} />
                      <Button size="sm" variant="ghost" title="Remover" onClick={() => remove(s)} icon={<Trash2 className="size-3.5 text-red-600" />} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <SupplierModal open={editing !== undefined} supplier={editing ?? null} onClose={() => setEditing(undefined)} />
    </>
  );
}

function SupplierModal({ open, supplier, onClose }: { open: boolean; supplier: Supplier | null; onClose: () => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const f = useForm<SupplierInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    f.setErrors({});
    f.setValues(supplier ? { name: supplier.name, document: supplier.document, phone: supplier.phone, email: supplier.email, contact: supplier.contact, notes: supplier.notes } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier]);

  async function save() {
    const data = f.validate(supplierSchema);
    if (!data) return;
    setBusy(true);
    try {
      if (supplier) await suppliersRepo.update(supplier.id, data);
      else await suppliersRepo.create(data);
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      fb.ok('Fornecedor salvo.');
      onClose();
    } catch (e) {
      f.applyApiError(e);
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }
  const v = f.values;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={supplier ? 'Editar fornecedor' : 'Novo fornecedor'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Nome *" value={v.name} onChange={(e) => f.set('name', e.target.value)} error={f.errors.name} autoFocus />
        <Input label="CNPJ/CPF" value={v.document} onChange={(e) => f.set('document', e.target.value)} />
        <Input label="Pessoa de contato" value={v.contact} onChange={(e) => f.set('contact', e.target.value)} />
        <Input label="Telefone" value={v.phone} onChange={(e) => f.set('phone', e.target.value)} />
        <Input wrapClass="sm:col-span-2" label="E-mail" value={v.email} onChange={(e) => f.set('email', e.target.value)} error={f.errors.email} />
        <Textarea wrapClass="sm:col-span-2" label="Observações" value={v.notes} onChange={(e) => f.set('notes', e.target.value)} />
      </div>
    </Modal>
  );
}
