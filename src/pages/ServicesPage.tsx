import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { DemoBadge } from '../components/StatusBadge';
import { NumInput } from '../components/NumInput';
import { useFeedback } from '../components/feedback';
import { Badge, Button, Empty, ErrorBox, Input, Modal, PageHeader, Select, Spinner, TableWrap, Textarea } from '../components/ui';
import { formatBRL, formatNumber, roundMoney } from '../calculations/money';
import { useForm } from '../hooks/useForm';
import { servicesRepo } from '../repositories';
import { serviceSchema, type ServiceInput } from '../schemas/entities';
import { SERVICE_CATEGORIES, type Service } from '../types/domain';

export function ServicesPage() {
  const [editing, setEditing] = useState<Service | null | undefined>(undefined);
  const fb = useFeedback();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['services'], queryFn: servicesRepo.list });

  async function remove(s: Service) {
    if (!(await fb.confirm({ title: 'Excluir serviço', message: `Excluir "${s.name}"? Orçamentos já salvos não são afetados.`, confirmLabel: 'Excluir', danger: true }))) return;
    try {
      await servicesRepo.remove(s.id);
      await qc.invalidateQueries({ queryKey: ['services'] });
      fb.ok('Serviço excluído.');
    } catch (e) {
      fb.error(e);
    }
  }

  return (
    <>
      <PageHeader
        title="Serviços e mão de obra"
        subtitle="Custo por hora ou preço fixo, usados na composição dos orçamentos."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
            Novo serviço
          </Button>
        }
      />
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <TableWrap>
          <Empty title="Nenhum serviço cadastrado" action={<Button variant="primary" onClick={() => setEditing(null)}>Cadastrar serviço</Button>} />
        </TableWrap>
      ) : (
        <TableWrap>
          <table className="tbl">
            <thead>
              <tr>
                <th>Serviço</th>
                <th className="hidden md:table-cell">Categoria</th>
                <th>Cobrança</th>
                <th className="text-right">Valor</th>
                <th className="hidden text-right sm:table-cell">Tempo estimado</th>
                <th className="hidden text-right sm:table-cell">Custo estimado</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((s) => (
                <tr key={s.id} className={s.status === 'inativo' ? 'opacity-60' : ''}>
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{s.name}</span>
                      {s.isDemo && <DemoBadge />}
                      {s.status === 'inativo' && <Badge>Inativo</Badge>}
                    </div>
                  </td>
                  <td className="hidden text-gray-600 md:table-cell">{s.category || '—'}</td>
                  <td className="text-gray-600">{s.mode === 'hour' ? 'Por hora' : `Preço fixo / ${s.unit}`}</td>
                  <td className="num text-right">{s.mode === 'hour' ? `${formatBRL(s.hourlyCost)}/h` : formatBRL(s.fixedPrice)}</td>
                  <td className="num hidden text-right sm:table-cell">{s.mode === 'hour' ? `${formatNumber(s.estimatedHours)} h` : '—'}</td>
                  <td className="num hidden text-right sm:table-cell">{formatBRL(s.mode === 'hour' ? roundMoney(s.hourlyCost * s.estimatedHours) : s.fixedPrice)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditing(s)} icon={<Pencil className="size-3.5" />} />
                      <Button size="sm" variant="ghost" title="Excluir" onClick={() => remove(s)} icon={<Trash2 className="size-3.5 text-red-600" />} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <ServiceFormModal open={editing !== undefined} service={editing ?? null} onClose={() => setEditing(undefined)} />
    </>
  );
}

const EMPTY: ServiceInput = { name: '', description: '', category: '', mode: 'hour', unit: 'h', hourlyCost: 0, fixedPrice: 0, estimatedHours: 0, status: 'ativo' };

function ServiceFormModal({ open, service, onClose }: { open: boolean; service: Service | null; onClose: () => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const f = useForm<ServiceInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    f.setErrors({});
    if (service) {
      const { name, description, category, mode, unit, hourlyCost, fixedPrice, estimatedHours, status } = service;
      f.setValues({ name, description, category, mode, unit, hourlyCost, fixedPrice, estimatedHours, status });
    } else f.setValues(EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service]);
  const v = f.values;

  async function save() {
    const data = f.validate(serviceSchema);
    if (!data) return;
    setBusy(true);
    try {
      if (service) await servicesRepo.update(service.id, data);
      else await servicesRepo.create(data);
      await qc.invalidateQueries({ queryKey: ['services'] });
      fb.ok(service ? 'Serviço atualizado.' : 'Serviço cadastrado.');
      onClose();
    } catch (e) {
      f.applyApiError(e);
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? 'Editar serviço' : 'Novo serviço'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Salvar serviço
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Input wrapClass="sm:col-span-2" label="Nome *" value={v.name} onChange={(e) => f.set('name', e.target.value)} error={f.errors.name} autoFocus />
        <Select label="Categoria" value={v.category} onChange={(e) => f.set('category', e.target.value)}>
          <option value="">—</option>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select label="Forma de cobrança" value={v.mode} onChange={(e) => f.set('mode', e.target.value as 'hour' | 'fixed')}>
          <option value="hour">Por hora</option>
          <option value="fixed">Preço fixo</option>
        </Select>
        {v.mode === 'hour' ? (
          <>
            <NumInput label="Custo por hora *" suffix="R$" value={v.hourlyCost} onChange={(n) => f.set('hourlyCost', n ?? 0)} error={f.errors.hourlyCost} />
            <NumInput label="Tempo estimado" suffix="h" value={v.estimatedHours} onChange={(n) => f.set('estimatedHours', n ?? 0)} />
            <div className="flex items-end pb-2 text-sm text-gray-600 sm:col-span-2">
              {formatNumber(v.estimatedHours)} h × {formatBRL(v.hourlyCost)} = <strong className="num ml-1 text-gray-900">{formatBRL(roundMoney(v.estimatedHours * v.hourlyCost))}</strong>
            </div>
          </>
        ) : (
          <>
            <NumInput label="Preço fixo *" suffix="R$" value={v.fixedPrice} onChange={(n) => f.set('fixedPrice', n ?? 0)} error={f.errors.fixedPrice} />
            <Input label="Unidade" value={v.unit} onChange={(e) => f.set('unit', e.target.value)} hint="Ex.: un, m, m², viagem" />
          </>
        )}
        <Textarea wrapClass="sm:col-span-3" label="Descrição" value={v.description} onChange={(e) => f.set('description', e.target.value)} rows={2} />
        <Select label="Status" value={v.status} onChange={(e) => f.set('status', e.target.value as 'ativo' | 'inativo')}>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </Select>
      </div>
    </Modal>
  );
}
